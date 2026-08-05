// backend/routes/intake.js
const express = require('express');
const router = express.Router();
const { authMiddleware } = require('./auth');
const IntakeSubmission = require('../models/IntakeSubmission');

// POST /api/intake/submit - client submits intake form
router.post('/submit', async (req, res) => {
  try {
    const { agencyId, clientName, clientEmail, companyName, projectTitle, projectScope, budget, timeline, notes, responses } = req.body;
    if (!clientName || !clientEmail || !projectTitle) {
      return res.status(400).json({ message: 'Name, email, and project title are required' });
    }

    const submission = await IntakeSubmission.create({
      agencyId: agencyId || null,
      clientName,
      clientEmail,
      companyName,
      projectTitle,
      projectScope,
      budget,
      timeline,
      notes,
      responses,
      status: 'pending'
    });

    return res.status(201).json({ success: true, submission });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// GET /api/intake/submissions - list submissions for logged in agency
router.get('/submissions', authMiddleware, async (req, res) => {
  try {
    const submissions = await IntakeSubmission.find({ agencyId: req.user._id }).sort({ createdAt: -1 });
    return res.status(200).json({ submissions });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// GET /api/intake/submission/:id - get single submission
router.get('/submission/:id', async (req, res) => {
  try {
    const submission = await IntakeSubmission.findById(req.params.id);
    if (!submission) return res.status(404).json({ message: 'Submission not found' });
    return res.status(200).json({ submission });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

module.exports = router;
