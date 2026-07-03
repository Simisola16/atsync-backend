// backend/routes/payments.js
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const https = require('https');
const supabase = require('../config/supabase');

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;

// ─── Helper: call Paystack REST API ────────────────────────────────────────
function paystackPost(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const options = {
      hostname: 'api.paystack.co',
      port: 443,
      path,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    };
    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', (chunk) => (raw += chunk));
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); }
        catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// ─── POST /api/payments/initiate ────────────────────────────────────────────
// Body: { agency_client_id, approval_id, amount, currency?, description?, email }
// Rule: approval_id must exist with status = 'approved' before we create a payment.
router.post('/initiate', async (req, res) => {
  try {
    const { agency_client_id, approval_id, amount, currency = 'NGN', description, email } = req.body;

    if (!agency_client_id || !approval_id || !amount || !email) {
      return res.status(400).json({ error: 'agency_client_id, approval_id, amount, and email are required.' });
    }

    // ── Application-level approval gate ──────────────────────────────────────
    // We enforce the approval-triggered rule here in code rather than a DB constraint,
    // because a CHECK constraint referencing another table's status column would require
    // a trigger in Postgres (not a clean inline FK). Application logic is cleaner here.
    const { data: approval, error: approvalErr } = await supabase
      .from('approvals')
      .select('id, status, agency_client_id')
      .eq('id', approval_id)
      .single();

    if (approvalErr || !approval) {
      return res.status(404).json({ error: 'Approval not found.' });
    }
    if (approval.status !== 'approved') {
      return res.status(403).json({
        error: `Payment blocked: approval status is '${approval.status}'. Only 'approved' approvals can trigger a payment.`
      });
    }
    if (approval.agency_client_id !== agency_client_id) {
      return res.status(403).json({ error: 'Approval does not belong to this client relationship.' });
    }

    // ── Check for existing pending/paid payment for this approval ─────────────
    const { data: existing } = await supabase
      .from('payments')
      .select('id, status')
      .eq('approval_id', approval_id)
      .in('status', ['pending', 'paid'])
      .maybeSingle();

    if (existing?.status === 'paid') {
      return res.status(409).json({ error: 'This approval has already been paid.' });
    }
    if (existing?.status === 'pending') {
      return res.status(409).json({ error: 'A payment is already pending for this approval. Complete or cancel it first.' });
    }

    // ── Initialize Paystack transaction ───────────────────────────────────────
    const amountKobo = Math.round(Number(amount) * 100); // Paystack uses kobo
    const paystackRes = await paystackPost('/transaction/initialize', {
      email,
      amount: amountKobo,
      currency,
      metadata: {
        agency_client_id,
        approval_id,
        description: description || 'Delivery payment',
      },
    });

    if (!paystackRes.status) {
      console.error('Paystack init error:', paystackRes);
      return res.status(502).json({ error: 'Paystack initialization failed.', detail: paystackRes.message });
    }

    const { reference, authorization_url, access_code } = paystackRes.data;

    // ── Create pending payment row ─────────────────────────────────────────────
    const { data: payment, error: insertErr } = await supabase
      .from('payments')
      .insert({
        agency_client_id,
        approval_id,
        amount: Number(amount),
        currency,
        status: 'pending',
        paystack_reference: reference,
        paystack_access_code: access_code,
        description: description || 'Delivery payment',
      })
      .select()
      .single();

    if (insertErr) {
      console.error('DB insert error:', insertErr);
      return res.status(500).json({ error: 'Failed to create payment record.', detail: insertErr.message });
    }

    return res.status(200).json({
      success: true,
      payment_id: payment.id,
      reference,
      authorization_url,
      access_code,
    });
  } catch (err) {
    console.error('initiate error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─── POST /api/payments/webhook ──────────────────────────────────────────────
// Paystack sends events here.
// express.json() in server.js stores the raw buffer on req.rawBody via its
// verify callback — we use that for HMAC-SHA512 verification.
router.post('/webhook', async (req, res) => {
  // ── 1. Verify Paystack signature ────────────────────────────────────────────
  const signature = req.headers['x-paystack-signature'];

  if (!req.rawBody) {
    console.warn('No rawBody available — cannot verify webhook signature.');
    return res.status(400).json({ error: 'Raw body not available for verification.' });
  }

  const expectedSig = crypto
    .createHmac('sha512', PAYSTACK_SECRET)
    .update(req.rawBody) // raw Buffer stored by verify hook in server.js
    .digest('hex');

  if (signature !== expectedSig) {
    console.warn('Webhook signature mismatch — rejecting request.');
    return res.status(401).json({ error: 'Invalid signature.' });
  }

  // ── 2. Read event (already parsed by express.json) ───────────────────────────
  const event = req.body;
  console.log(`Paystack webhook received: ${event?.event}`);

  const ref = event?.data?.reference;
  if (!ref) {
    return res.status(200).json({ received: true }); // ack, nothing to do
  }

  // ── 3. Handle charge.success ─────────────────────────────────────────────────
  if (event.event === 'charge.success') {
    const { error } = await supabase
      .from('payments')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
      })
      .eq('paystack_reference', ref);

    if (error) {
      console.error('Failed to update payment to paid:', error.message);
      // Return 200 anyway so Paystack doesn't retry endlessly
    } else {
      console.log(`Payment ${ref} marked as PAID.`);
    }
  }

  // ── 4. Handle charge.failed ──────────────────────────────────────────────────
  if (event.event === 'charge.failed') {
    await supabase
      .from('payments')
      .update({ status: 'failed' })
      .eq('paystack_reference', ref);
    console.log(`Payment ${ref} marked as FAILED.`);
  }

  // Always acknowledge quickly
  return res.status(200).json({ received: true });
});

// ─── GET /api/payments/public-key ────────────────────────────────────────────
// Safe endpoint to expose the public key to the frontend
router.get('/public-key', (_req, res) => {
  res.json({ publicKey: process.env.PAYSTACK_PUBLIC_KEY || '' });
});

module.exports = router;
