const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { Resend } = require('resend');
// Load environment variables for backend (including RESEND_API_KEY)
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
// Ensure the Resend API key is available; otherwise log a clear error
if (!process.env.RESEND_API_KEY) {
  console.error('❌ RESEND_API_KEY is not set in environment variables. Email sending will fail.');
}
const resend = new Resend(process.env.RESEND_API_KEY);

// @route   POST /api/waitlist/join
// @desc    Add email to waitlist and send a welcome email with verification link (no localhost redirect)
router.post('/join', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }
  try {
    // Insert into waitlist table (create if not exists)
    const { error: insertError } = await supabase.from('waitlist').upsert({ email });
    if (insertError) {
      console.error('Waitlist insert error:', insertError);
      return res.status(500).json({ message: 'Failed to add to waitlist' });
    }

    // Generate a verification link (reuse signup link generation but without password)
    const clientUrl = 'https://atsync.app';
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: {
        redirectTo: `${clientUrl}/welcome`,
        emailRedirectTo: clientUrl,
      },
    });
    if (linkError) {
      console.error('Link generation error:', linkError);
      return res.status(500).json({ message: 'Failed to create verification link' });
    }
    const actionLink = linkData?.properties?.action_link || '';

    const htmlContent = `
  <div style="background:#f9fafb;font-family:'Inter',Arial,Helvetica,sans-serif;padding:40px 0;">
    <div style="max-width:600px;margin:auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.1);">
      <div style="background:#0f172a;padding:20px;text-align:center;">
        <img src="https://atsync.app/logo.png" alt="ATSYNC" style="width:80px;margin-bottom:10px;" />
        <h1 style="color:#00e5ff;margin:0;font-size:24px;">Welcome to ATSYNC!</h1>
      </div>
      <div style="padding:30px;color:#1e293b;">
        <p style="font-size:16px;line-height:1.5;">Hi there,</p>
        <p style="font-size:16px;line-height:1.5;">Thank you for joining the ATSYNC waitlist. We're excited to have you on board. Please verify your email address to complete the signup.</p>
        <div style="text-align:center;margin:30px 0;">
          <a href="${actionLink}" style="background:#00e5ff;color:#0f172a;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block;">Verify Email</a>
        </div>
        <p style="font-size:14px;color:#64748b;">If the button doesn't work, copy and paste the link below into your browser:</p>
        <p style="font-size:14px;color:#00e5ff;word-break:break-all;">${actionLink}</p>
      </div>
      <div style="background:#0f172a;padding:15px;text-align:center;color:#94a3b8;font-size:12px;">
        © 2026 ATSYNC. All rights reserved.<br />
        Need help? <a href="mailto:atlassync1@gmail.com" style="color:#00e5ff;">atlassync1@gmail.com</a>
      </div>
    </div>
  </div>`;

    const { error: emailError } = await resend.emails.send({
      from: 'no-reply@atsync.app',
      to: email,
      subject: 'Welcome to ATSYNC – Verify Your Email',
      html: htmlContent,
    });
    if (emailError) {
      console.error('Resend email error:', emailError);
      return res.status(500).json({ message: 'Failed to send verification email' });
    } else {
      console.log('✅ Verification email sent to', email);
    }

    return res.status(200).json({ message: 'Added to waitlist and verification email sent' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
