// backend/routes/waitlist.js
const express = require('express');
const router = express.Router();
const Waitlist = require('../models/Waitlist');
const { Resend } = require('resend');
require('dotenv').config();

const resend = new Resend(process.env.RESEND_API_KEY || 'dummy');

// @route   POST /api/waitlist/join
// @desc    Add email to waitlist and send welcome email
router.post('/join', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  try {
    const existing = await Waitlist.findOne({ email: email.toLowerCase() });
    if (!existing) {
      await Waitlist.create({ email: email.toLowerCase() });
    }

    if (process.env.RESEND_API_KEY) {
      try {
        await resend.emails.send({
          from: 'ATSYNC <noreply@atsync.app>',
          to: email,
          subject: 'Welcome to ATSYNC Waitlist!',
          html: `<p>Thank you for joining the ATSYNC waitlist! We will notify you as soon as early access is available.</p>`
        });
      } catch (emailErr) {
        console.error('Waitlist email sending error:', emailErr);
      }
    }

    return res.status(200).json({ message: 'Added to waitlist successfully' });
  } catch (err) {
    console.error('Waitlist error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
