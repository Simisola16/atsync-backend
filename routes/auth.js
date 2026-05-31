// backend/routes/auth.js
const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

// @route   POST /api/auth/register
// @desc    Register new agency user via Supabase Auth
router.post('/register', async (req, res) => {
  const { agencyName, email, password } = req.body;
  if (!agencyName || !email || !password) {
    return res.status(400).json({ message: 'All fields are required' });
  }
  try {
    // Generate signup confirmation link via Supabase Admin API
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'signup',
      email,
      password,
      options: {
        data: { agency_name: agencyName },
        redirectTo: `${process.env.CLIENT_URL || 'https://atsync.app'}/agent-onboard`
      }
    });

    if (linkError) {
      return res.status(400).json({ message: linkError.message });
    }

    if (!linkData || !linkData.properties || !linkData.properties.action_link) {
      return res.status(500).json({ message: 'Failed to generate verification link' });
    }

    const actionLink = linkData.properties.action_link;

    // Insert agency profile in profiles table
    if (linkData.user) {
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: linkData.user.id,
        agency_name: agencyName,
        email: email,
      });
      if (profileError) {
        console.error('Profile upsert error:', profileError);
      }
    }

    // Professional HTML Email Template
    const htmlContent = `
<div style="background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 48px 20px; min-height: 100%;">
  <div style="background-color: #1e293b; border: 1px solid #334155; border-radius: 12px; margin: 0 auto; max-width: 560px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4);">
    <!-- Header -->
    <div style="background-color: #1e293b; border-bottom: 1px solid #334155; padding: 32px 24px; text-align: center;">
      <span style="font-size: 24px; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase;">
        <span style="color: #ffffff;">ATS</span><span style="color: #00e5ff;">YNC</span>
      </span>
    </div>
    <!-- Content -->
    <div style="padding: 40px 32px;">
      <h1 style="color: #ffffff; font-size: 24px; font-weight: 700; line-height: 32px; margin-top: 0; margin-bottom: 16px;">Confirm your registration</h1>
      <p style="color: #cbd5e1; font-size: 16px; line-height: 24px; margin-top: 0; margin-bottom: 24px;">Hello ${agencyName},</p>
      <p style="color: #cbd5e1; font-size: 16px; line-height: 24px; margin-top: 0; margin-bottom: 24px;">Thank you for registering. Please verify your email address to complete your ATSYNC account setup and gain access to your dashboard.</p>
      <div style="margin: 36px 0; text-align: center;">
        <a href="${actionLink}" style="background: linear-gradient(135deg, #00e5ff 0%, #00bfff 100%); background-color: #00e5ff; border-radius: 6px; color: #0f172a; display: inline-block; font-size: 16px; font-weight: 700; line-height: 50px; text-align: center; text-decoration: none; width: 240px; box-shadow: 0 4px 12px rgba(0, 229, 255, 0.25);">Verify Email Address</a>
      </div>
      <p style="color: #94a3b8; font-size: 14px; line-height: 20px; margin-top: 0; margin-bottom: 24px;">This link will expire in 24 hours. If you did not create an ATSYNC account, you can safely ignore this email.</p>
      <hr style="border: 0; border-top: 1px solid #334155; margin: 32px 0;" />
      <p style="color: #94a3b8; font-size: 12px; line-height: 18px; margin-top: 0; margin-bottom: 8px;">If you're having trouble clicking the button, copy and paste this URL into your web browser:</p>
      <p style="margin-top: 0; margin-bottom: 0; word-break: break-all;"><a href="${actionLink}" style="color: #00e5ff; font-size: 12px; text-decoration: none; word-break: break-all;">${actionLink}</a></p>
    </div>
    <!-- Footer -->
    <div style="background-color: #0f172a; border-top: 1px solid #334155; padding: 24px 32px; text-align: center;">
      <p style="color: #64748b; font-size: 12px; line-height: 18px; margin-top: 0; margin-bottom: 4px;">© 2026 ATSYNC. All rights reserved.</p>
      <p style="color: #64748b; font-size: 12px; line-height: 18px; margin-top: 0; margin-bottom: 0;">Need help? Reach out at <a href="mailto:atlassync1@gmail.com" style="color: #00e5ff; text-decoration: none;">atlassync1@gmail.com</a></p>
    </div>
  </div>
</div>
    `;

    // Send verification email via Resend
    try {
      const { data: emailData, error: emailError } = await resend.emails.send({
        from: 'no-reply@atsync.app',
        to: email,
        subject: 'Activate Your ATSYNC Account',
        html: htmlContent
      });

      if (emailError) {
        console.error('Resend email error:', emailError);
        return res.status(400).json({ message: `Verification email failed to send: ${emailError.message}` });
      }
    } catch (e) {
      console.error('Resend exception:', e);
      return res.status(500).json({ message: `Verification email failed to send: ${e.message}` });
    }

    res.status(201).json({ message: 'User registered. Please check your email to verify.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/auth/login
// @desc    Login user via Supabase Auth and return session details
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password required' });
  }
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return res.status(400).json({ message: error.message });
    }

    // Fetch user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('agency_name')
      .eq('id', data.user.id)
      .single();

    res.json({
      token: data.session.access_token,
      agencyName: profile?.agency_name || data.user.user_metadata?.agency_name || '',
      email: data.user.email,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
