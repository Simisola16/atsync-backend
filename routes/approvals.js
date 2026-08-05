// backend/routes/approvals.js
const express = require('express');
const router = express.Router();
const { authMiddleware } = require('./auth');
const Approval = require('../models/Approval');

// GET /api/approvals - list approvals
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    const approvals = await Approval.find({
      $or: [{ agencyId: userId }, { clientId: userId }]
    }).sort({ createdAt: -1 });

    return res.status(200).json({ approvals });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// POST /api/approvals - create approval request
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { clientId, projectId, type, title, description } = req.body;
    const approval = await Approval.create({
      agencyId: req.user._id,
      clientId,
      projectId,
      type,
      title,
      description,
      requestedBy: req.user._id,
      status: 'pending'
    });

    return res.status(201).json({ approval });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// PATCH /api/approvals/:id/status - approve or reject
router.patch('/:id/status', authMiddleware, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Status must be approved or rejected' });
    }

    const approval = await Approval.findByIdAndUpdate(
      req.params.id,
      { status, resolvedAt: new Date() },
      { new: true }
    );

    return res.status(200).json({ approval });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

module.exports = router;
