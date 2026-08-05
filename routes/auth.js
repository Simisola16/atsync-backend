// backend/routes/auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Profile = require('../models/Profile');
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY || 'dummy_key');
const JWT_SECRET = process.env.JWT_SECRET || 'atsync_jwt_secret_key_123';

// Auth middleware
const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No authentication token provided' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({ message: 'Invalid session' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

// @route   POST /api/auth/register
// @desc    Register new agency user and send verification OTP
router.post('/register', async (req, res) => {
  const { agencyName, email, password } = req.body;
  if (!agencyName || !email || !password) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    const user = new User({
      email: email.toLowerCase(),
      password: hashedPassword,
      agencyName,
      role: 'agency',
      isVerified: false,
      otp,
      otpExpires
    });

    await user.save();

    await Profile.create({
      userId: user._id,
      agencyName,
      email: email.toLowerCase()
    });

    // Send email with OTP via Resend if configured
    if (process.env.RESEND_API_KEY) {
      try {
        await resend.emails.send({
          from: 'ATSYNC <noreply@atsync.app>',
          to: email,
          subject: `${otp} is your ATSYNC verification code`,
          html: `<p>Your verification code for ATSYNC is <strong>${otp}</strong>. It expires in 15 minutes.</p>`
        });
      } catch (emailErr) {
        console.error('Failed to send verification email:', emailErr);
      }
    }

    return res.status(200).json({
      message: 'Registration successful. Check your email for OTP verification.',
      user: { id: user._id, email: user.email, agencyName: user.agencyName }
    });
  } catch (err) {
    console.error('Registration error:', err);
    return res.status(500).json({ message: err.message || 'Server error' });
  }
});

// @route   POST /api/auth/verify-otp
// @desc    Verify email OTP
router.post('/verify-otp', async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    return res.status(400).json({ message: 'Email and OTP are required' });
  }

  try {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.otp !== otp || user.otpExpires < new Date()) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    user.isVerified = true;
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    const token = jwt.sign({ id: user._id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    const profile = await Profile.findOne({ userId: user._id });

    return res.status(200).json({
      token,
      user: {
        id: user._id,
        email: user.email,
        agencyName: user.agencyName,
        role: user.role,
        profile
      }
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// @route   POST /api/auth/login
// @desc    User login with email and password
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  try {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user._id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    const profile = await Profile.findOne({ userId: user._id });

    return res.status(200).json({
      token,
      user: {
        id: user._id,
        email: user.email,
        agencyName: user.agencyName,
        role: user.role,
        profile
      }
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user session
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const profile = await Profile.findOne({ userId: req.user._id });
    return res.status(200).json({
      user: {
        id: req.user._id,
        email: req.user.email,
        agencyName: req.user.agencyName,
        role: req.user.role,
        profile
      }
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// @route   POST /api/auth/reset-password-request
router.post('/reset-password-request', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'Email required' });

  try {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(200).json({ message: 'If an account exists, a reset code was sent.' });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.resetPasswordToken = otp;
    user.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();

    if (process.env.RESEND_API_KEY) {
      await resend.emails.send({
        from: 'ATSYNC <noreply@atsync.app>',
        to: email,
        subject: `Reset your ATSYNC password`,
        html: `<p>Your password reset code is <strong>${otp}</strong>.</p>`
      });
    }

    return res.status(200).json({ message: 'Password reset code sent to email.' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// @route   POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  const { email, code, newPassword } = req.body;
  if (!email || !code || !newPassword) {
    return res.status(400).json({ message: 'Email, code, and new password are required' });
  }

  try {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || user.resetPasswordToken !== code || user.resetPasswordExpires < new Date()) {
      return res.status(400).json({ message: 'Invalid or expired reset code' });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    return res.status(200).json({ message: 'Password updated successfully.' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

module.exports = router;
module.exports.authMiddleware = authMiddleware;
