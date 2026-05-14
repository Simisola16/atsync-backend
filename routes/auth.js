// backend/routes/auth.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const Resend = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

// Helper to send verification email
const sendVerificationEmail = async (email, token) => {
  const verificationLink = `${process.env.CLIENT_URL || 'http://localhost:3000'}/verify-email?token=${token}`;
  await resend.emails.send({
    from: 'no-reply@atsync.com',
    to: email,
    subject: 'Verify your ATSYNC account',
    html: `<p>Welcome! Please verify your email by clicking the link below:</p><p><a href="${verificationLink}">${verificationLink}</a></p>`,
  });
};

// @route   POST /api/auth/register
// @desc    Register new agency user and send verification email
router.post('/register', async (req, res) => {
  const { agencyName, email, password } = req.body;
  if (!agencyName || !email || !password) {
    return res.status(400).json({ message: 'All fields are required' });
  }
  try {
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: 'Email already in use' });
    const verificationToken = uuidv4();
    const newUser = new User({ agencyName, email, password, verificationToken });
    await newUser.save();
    await sendVerificationEmail(email, verificationToken);
    res.status(201).json({ message: 'User registered. Check email to verify.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/auth/verify
// @desc    Verify email token
router.get('/verify', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ message: 'Token missing' });
  try {
    const user = await User.findOne({ verificationToken: token });
    if (!user) return res.status(400).json({ message: 'Invalid token' });
    user.isVerified = true;
    user.verificationToken = undefined;
    await user.save();
    res.json({ message: 'Email verified successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/auth/login
// @desc    Login user and return JWT
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password required' });
  }
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });
    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });
    if (!user.isVerified) return res.status(403).json({ message: 'Please verify your email first' });
    const payload = { id: user._id, agencyName: user.agencyName };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, agencyName: user.agencyName, email: user.email });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
