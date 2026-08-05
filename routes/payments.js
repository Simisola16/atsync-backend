// backend/routes/payments.js
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const https = require('https');
const Payment = require('../models/Payment');
const Approval = require('../models/Approval');

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
router.post('/initiate', async (req, res) => {
  try {
    const { agency_client_id, approval_id, amount, currency = 'NGN', description, email } = req.body;

    if (!agency_client_id || !approval_id || !amount || !email) {
      return res.status(400).json({ error: 'agency_client_id, approval_id, amount, and email are required.' });
    }

    const approval = await Approval.findById(approval_id);
    if (!approval) {
      return res.status(404).json({ error: 'Approval not found.' });
    }
    if (approval.status !== 'approved') {
      return res.status(403).json({
        error: `Payment blocked: approval status is '${approval.status}'. Only 'approved' approvals can trigger a payment.`
      });
    }

    const existing = await Payment.findOne({
      approvalId: approval_id,
      status: { $in: ['pending', 'paid'] }
    });

    if (existing?.status === 'paid') {
      return res.status(409).json({ error: 'This approval has already been paid.' });
    }
    if (existing?.status === 'pending') {
      return res.status(409).json({ error: 'A payment is already pending for this approval.' });
    }

    const amountKobo = Math.round(Number(amount) * 100);
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

    const payment = await Payment.create({
      agencyId: approval.agencyId,
      clientId: approval.clientId,
      approvalId: approval_id,
      amount: Number(amount),
      currency,
      status: 'pending',
      paystackReference: reference,
      paystackAccessCode: access_code,
      description: description || 'Delivery payment',
    });

    return res.status(200).json({
      success: true,
      payment_id: payment._id,
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
router.post('/webhook', async (req, res) => {
  const signature = req.headers['x-paystack-signature'];

  if (!req.rawBody) {
    console.warn('No rawBody available — cannot verify webhook signature.');
    return res.status(400).json({ error: 'Raw body not available for verification.' });
  }

  const expectedSig = crypto
    .createHmac('sha512', PAYSTACK_SECRET)
    .update(req.rawBody)
    .digest('hex');

  if (signature !== expectedSig) {
    console.warn('Webhook signature mismatch — rejecting request.');
    return res.status(401).json({ error: 'Invalid signature.' });
  }

  const event = req.body;
  console.log(`Paystack webhook received: ${event?.event}`);

  const ref = event?.data?.reference;
  if (!ref) {
    return res.status(200).json({ received: true });
  }

  if (event.event === 'charge.success') {
    await Payment.findOneAndUpdate(
      { paystackReference: ref },
      { status: 'paid', paidAt: new Date() }
    );
    console.log(`Payment ${ref} marked as PAID.`);
  }

  if (event.event === 'charge.failed') {
    await Payment.findOneAndUpdate(
      { paystackReference: ref },
      { status: 'failed' }
    );
    console.log(`Payment ${ref} marked as FAILED.`);
  }

  return res.status(200).json({ received: true });
});

// ─── GET /api/payments/public-key ────────────────────────────────────────────
router.get('/public-key', (_req, res) => {
  res.json({ publicKey: process.env.PAYSTACK_PUBLIC_KEY || '' });
});

module.exports = router;
