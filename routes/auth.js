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
    // Use production domain for email verification redirects, ignore any localhost settings.
    const clientUrl = 'https://atsync.app';

    // Generate signup confirmation link via Supabase Admin API
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'signup',
      email,
      password,
      options: {
        data: { agency_name: agencyName },
        redirectTo: `${clientUrl}/agent-onboard`
      }
    });

    if (linkError) {
      return res.status(400).json({ message: linkError.message });
    }

    if (!linkData || !linkData.properties || !linkData.properties.hashed_token) {
      return res.status(500).json({ message: 'Failed to generate verification link' });
    }

    const backendUrl = process.env.BACKEND_URL || 'https://atsync-backend-vdko.onrender.com';
    const actionLink = `${backendUrl}/api/auth/verify?token_hash=${linkData.properties.hashed_token}&type=signup`;

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
        from: 'support@atsync.app', // verified professional sender
        reply_to: 'support@atsync.app',
        to: email,
        subject: 'Activate Your ATSYNC Account',
        html: htmlContent,
        text: `Activate your ATSYNC account by clicking the link: ${actionLink}`
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

 // @route   POST /api/auth/forgot-password
// @desc    Send password reset email via Supabase and Resend
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }
  try {
    // Use Supabase Admin API to generate a password recovery link
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: {
        redirectTo: 'https://atsync.app/reset', // front‑end reset page (no localhost)
      },
    });
    if (linkError) {
      return res.status(400).json({ message: linkError.message });
    }

    if (!linkData || !linkData.properties || !linkData.properties.hashed_token) {
      return res.status(500).json({ message: 'Failed to generate reset link' });
    }

    const backendUrl = process.env.BACKEND_URL || 'https://atsync-backend-vdko.onrender.com';
    const actionLink = `${backendUrl}/api/auth/verify?token_hash=${linkData.properties.hashed_token}&type=recovery`;

    const htmlContent = `
      <div style="background-color:#0f172a;font-family:Arial,Helvetica,sans-serif;padding:48px 20px;min-height:100%;">
        <div style="background-color:#1e293b;border:1px solid #334155;border-radius:12px;margin:0 auto;max-width:560px;overflow:hidden;box-shadow:0 10px 25px -5px rgba(0,0,0,0.4);">
          <div style="background-color:#1e293b;border-bottom:1px solid #334155;padding:32px 24px;text-align:center;">
            <span style="font-size:24px;font-weight:800;letter-spacing:0.05em;text-transform:uppercase;color:#00e5ff;">ATSYNC Password Reset</span>
          </div>
          <div style="padding:40px 32px;">
            <h1 style="color:#ffffff;font-size:24px;font-weight:700;margin-bottom:16px;">Reset Your Password</h1>
            <p style="color:#cbd5e1;font-size:16px;line-height:24px;margin-bottom:24px;">We received a request to reset the password for your ATSYNC account.</p>
            <div style="text-align:center;margin:36px 0;">
              <a href="${actionLink}" style="background:#00e5ff;border-radius:6px;color:#0f172a;display:inline-block;font-size:16px;font-weight:700;line-height:50px;text-decoration:none;width:240px;box-shadow:0 4px 12px rgba(0,229,255,0.25);">Reset Password</a>
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

    // Send email via Resend
    const { error: emailError } = await resend.emails.send({
      from: 'support@atsync.app',
      reply_to: 'support@atsync.app',
      to: email,
      subject: 'ATSYNC – Password Reset Request',
      html: htmlContent,
      text: `Reset your ATSYNC password using this link: ${actionLink}`,
    });
    if (emailError) {
      console.error('Resend email error:', emailError);
      return res.status(500).json({ message: 'Failed to send reset email' });
    }
    return res.status(200).json({ message: 'Password reset email sent' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/auth/verify
// @desc    Verify email token_hash and redirect to frontend with session
router.get('/verify', async (req, res) => {
  const { token_hash, type } = req.query;
  const clientUrl = 'https://atsync.app';
  
  if (!token_hash) {
    return res.status(400).send(`
      <html>
        <head>
          <title>Verification Failed | ATSYNC</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              margin: 0;
              padding: 0;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              background-color: #0f172a;
              color: #ffffff;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }
            .card {
              background-color: #1e293b;
              border: 1px solid #334155;
              border-radius: 16px;
              padding: 40px;
              max-width: 480px;
              width: 90%;
              text-align: center;
              box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
            }
            h1 {
              color: #ef4444;
              font-size: 28px;
              margin-bottom: 16px;
            }
            p {
              color: #94a3b8;
              font-size: 16px;
              line-height: 1.6;
              margin-bottom: 24px;
            }
            .btn {
              background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
              color: #ffffff;
              border-radius: 8px;
              padding: 12px 32px;
              text-decoration: none;
              font-weight: 700;
              display: inline-block;
              box-shadow: 0 4px 12px rgba(239, 68, 68, 0.2);
            }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>Verification Failed</h1>
            <p>The verification link is missing required parameters. Please request a new verification email from the homepage.</p>
            <a href="${clientUrl}" class="btn">Go to Homepage</a>
          </div>
        </body>
      </html>
    `);
  }

  try {
    // Verify the OTP via Supabase
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type || 'signup'
    });

    if (error) {
      console.error('verifyOtp error:', error);
      return res.status(400).send(`
        <html>
          <head>
            <title>Link Expired | ATSYNC</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body {
                margin: 0;
                padding: 0;
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
                background-color: #0f172a;
                color: #ffffff;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              }
              .card {
                background-color: #1e293b;
                border: 1px solid #334155;
                border-radius: 16px;
                padding: 40px;
                max-width: 480px;
                width: 90%;
                text-align: center;
                box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
              }
              h1 {
                color: #f59e0b;
                font-size: 28px;
                margin-bottom: 16px;
              }
              p {
                color: #94a3b8;
                font-size: 16px;
                line-height: 1.6;
                margin-bottom: 24px;
              }
              .btn {
                background: linear-gradient(135deg, #00e5ff 0%, #00bfff 100%);
                color: #0f172a;
                border-radius: 8px;
                padding: 12px 32px;
                text-decoration: none;
                font-weight: 700;
                display: inline-block;
                box-shadow: 0 4px 12px rgba(0, 229, 255, 0.25);
              }
            </style>
          </head>
          <body>
            <div class="card">
              <h1>Link Expired or Invalid</h1>
              <p>This verification link is invalid or has already expired. If you already verified, please try logging in.</p>
              <a href="${clientUrl}" class="btn">Go to Login</a>
            </div>
          </body>
        </html>
      `);
    }

    // Success! Redirect to frontend with access_token and refresh_token
    const session = data.session;
    const targetUrl = type === 'recovery' 
      ? `${clientUrl}/reset`
      : `${clientUrl}/agent-onboard`;

    // Construct the redirect URL with hash parameters
    const redirectUrl = `${targetUrl}#access_token=${session.access_token}&refresh_token=${session.refresh_token}&type=${type || 'signup'}`;

    return res.status(200).send(`
      <html>
        <head>
          <title>Email Verified | ATSYNC</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              margin: 0;
              padding: 0;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              background-color: #0f172a;
              color: #ffffff;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              overflow: hidden;
            }
            .card {
              background-color: #1e293b;
              border: 1px solid #334155;
              border-radius: 16px;
              padding: 40px;
              max-width: 480px;
              width: 90%;
              text-align: center;
              box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
              position: relative;
            }
            .success-icon {
              font-size: 64px;
              margin-bottom: 24px;
              animation: scaleUp 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) both;
            }
            h1 {
              color: #ffffff;
              font-size: 28px;
              margin-bottom: 12px;
              font-weight: 800;
            }
            span.logo-cyan {
              color: #00e5ff;
            }
            p {
              color: #94a3b8;
              font-size: 16px;
              line-height: 1.6;
              margin-bottom: 32px;
            }
            .loader {
              width: 48px;
              height: 48px;
              border: 3px solid #334155;
              border-radius: 50%;
              display: inline-block;
              position: relative;
              box-sizing: border-box;
              animation: rotation 1s linear infinite;
            }
            .loader::after {
              content: '';  
              box-sizing: border-box;
              position: absolute;
              left: 0;
              top: 0;
              background: #00e5ff;
              width: 16px;
              height: 16px;
              border-radius: 50%;
            }
            @keyframes rotation {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            @keyframes scaleUp {
              0% { transform: scale(0); }
              100% { transform: scale(1); }
            }
          </style>
          <script>
            setTimeout(function() {
              window.location.href = "${redirectUrl}";
            }, 2500);
          </script>
        </head>
        <body>
          <div class="card">
            <div class="success-icon">✨</div>
            <h1>Email Verified!</h1>
            <p>Welcome to <span class="logo-cyan">ATSYNC</span>. We've successfully verified your email. Preparing your workspace...</p>
            <span class="loader"></span>
          </div>
        </body>
      </html>
    `);
  } catch (err) {
    console.error('Server verify route error:', err);
    return res.status(500).send('Server error during verification');
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
