// backend/routes/workspace.js
const express = require('express');
const router = express.Router();
const { authMiddleware } = require('./auth');
const User = require('../models/User');
const Profile = require('../models/Profile');
const Staff = require('../models/Staff');
const IntakeSubmission = require('../models/IntakeSubmission');

// GET /api/workspace/data - get agency profile, staff, and clients
router.get('/data', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;

    const profile = await Profile.findOne({ userId });
    const staff = await Staff.find({ agencyId: userId });
    const clients = await IntakeSubmission.find({ agencyId: userId });

    return res.status(200).json({
      profile,
      staff,
      clients
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// POST /api/workspace/profile - update agency profile
router.post('/profile', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    const updateData = req.body;

    const profile = await Profile.findOneAndUpdate(
      { userId },
      { $set: updateData },
      { new: true, upsert: true }
    );

    return res.status(200).json({ profile });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

module.exports = router;
