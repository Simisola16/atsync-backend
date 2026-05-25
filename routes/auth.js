// backend/routes/auth.js
const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

// @route   POST /api/auth/register
// @desc    Register new agency user via Supabase Auth
router.post('/register', async (req, res) => {
  const { agencyName, email, password } = req.body;
  if (!agencyName || !email || !password) {
    return res.status(400).json({ message: 'All fields are required' });
  }
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { agency_name: agencyName },
      },
    });

    if (error) {
      return res.status(400).json({ message: error.message });
    }

    // Insert agency profile in profiles table
    if (data.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        agency_name: agencyName,
        email: email,
      });
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
