// backend/routes/inbox.js
// Exposes Resend's email-receiving API as REST endpoints.
// All four operations the SDK supports are surfaced here:
//   GET  /api/inbox/emails            – list all received emails
//   GET  /api/inbox/emails/:emailId   – get one received email by ID
//   GET  /api/inbox/emails/:emailId/attachments          – list attachments for an email
//   GET  /api/inbox/emails/:emailId/attachments/:attId   – get one attachment

const express = require('express');
const router = express.Router();
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

// ── Helper: uniform error response ──────────────────────────────────────────
function handleResendError(res, error, label) {
  console.error(`[inbox] ${label} error:`, error);
  return res.status(500).json({
    message: `Failed to ${label}`,
    error: error?.message || String(error),
  });
}

// ── 1. List all received emails ──────────────────────────────────────────────
// GET /api/inbox/emails
// Optional query params forwarded to Resend: ?limit=&page=
router.get('/emails', async (req, res) => {
  try {
    const { data, error } = await resend.emails.receiving.list();
    if (error) return handleResendError(res, error, 'list received emails');
    return res.status(200).json(data);
  } catch (err) {
    return handleResendError(res, err, 'list received emails');
  }
});

// ── 2. Get a single received email ───────────────────────────────────────────
// GET /api/inbox/emails/:emailId
router.get('/emails/:emailId', async (req, res) => {
  const { emailId } = req.params;
  try {
    const { data, error } = await resend.emails.receiving.get(emailId);
    if (error) return handleResendError(res, error, 'get received email');
    return res.status(200).json(data);
  } catch (err) {
    return handleResendError(res, err, 'get received email');
  }
});

// ── 3. List attachments for a received email ─────────────────────────────────
// GET /api/inbox/emails/:emailId/attachments
router.get('/emails/:emailId/attachments', async (req, res) => {
  const { emailId } = req.params;
  try {
    const { data, error } = await resend.emails.receiving.attachments.list({ emailId });
    if (error) return handleResendError(res, error, 'list attachments');
    return res.status(200).json(data);
  } catch (err) {
    return handleResendError(res, err, 'list attachments');
  }
});

// ── 4. Get a single attachment ───────────────────────────────────────────────
// GET /api/inbox/emails/:emailId/attachments/:attId
router.get('/emails/:emailId/attachments/:attId', async (req, res) => {
  const { emailId, attId } = req.params;
  try {
    const { data, error } = await resend.emails.receiving.attachments.get({
      id: attId,
      emailId,
    });
    if (error) return handleResendError(res, error, 'get attachment');
    return res.status(200).json(data);
  } catch (err) {
    return handleResendError(res, err, 'get attachment');
  }
});

module.exports = router;
