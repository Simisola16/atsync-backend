const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { Resend } = require('resend');
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
      <div style="background-color:#0f172a;font-family:Arial,Helvetica,sans-serif;padding:48px 20px;min-height:100%;">
        <div style="background-color:#1e293b;border:1px solid #334155;border-radius:12px;margin:0 auto;max-width:560px;overflow:hidden;box-shadow:0 10px 25px -5px rgba(0,0,0,0.4);">
          <div style="background-color:#1e293b;border-bottom:1px solid #334155;padding:32px 24px;text-align:center;">
            <span style="font-size:24px;font-weight:800;letter-spacing:0.05em;text-transform:uppercase;color:#00e5ff;">ATSYNC Waitlist</span>
          </div>
          <div style="padding:40px 32px;">
            <h1 style="color:#ffffff;font-size:24px;font-weight:700;margin-bottom:16px;">Welcome to ATSYNC!</h1>
            <p style="color:#cbd5e1;font-size:16px;line-height:24px;margin-bottom:24px;">Thanks for joining our waitlist. Click the button below to verify your email and stay updated.</p>
            <div style="text-align:center;margin:36px 0;">
              <a href="${actionLink}" style="background:#00e5ff;border-radius:6px;color:#0f172a;display:inline-block;font-size:16px;font-weight:700;line-height:50px;text-decoration:none;width:240px;box-shadow:0 4px 12px rgba(0,229,255,0.25);">Verify Email</a>
            </div>
            <p style="color:#94a3b8;font-size:12px;line-height:18px;">If the button doesn't work, copy and paste this URL into your browser:</p>
            <p style="font-size:12px;color:#00e5ff;word-break:break-all;">${actionLink}</p>
          </div>
          <div style="background-color:#0f172a;border-top:1px solid #334155;padding:24px 32px;text-align:center;">
            <p style="color:#64748b;font-size:12px;">© 2026 ATSYNC. All rights reserved.</p>
            <p style="color:#64748b;font-size:12px;">Need help? <a href="mailto:atlassync1@gmail.com" style="color:#00e5ff;">atlassync1@gmail.com</a></p>
          </div>
        </div>
      </div>
    `;

    const { error: emailError } = await resend.emails.send({
      from: 'no-reply@atsync.app',
      to: email,
      subject: 'Welcome to ATSYNC – Verify Your Email',
      html: htmlContent,
    });
    if (emailError) {
      console.error('Resend email error:', emailError);
      return res.status(500).json({ message: 'Failed to send verification email' });
    }

    return res.status(200).json({ message: 'Added to waitlist and verification email sent' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
