// backend/routes/chat.js
const express = require('express');
const router = express.Router();
const { authMiddleware } = require('./auth');
const Message = require('../models/Message');

// GET /api/chat/messages - list chat messages for user
router.get('/messages', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    const messages = await Message.find({
      $or: [{ agencyId: userId }, { clientId: userId }]
    }).sort({ createdAt: 1 });

    return res.status(200).json({ messages });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// POST /api/chat/messages - send chat message
router.post('/messages', authMiddleware, async (req, res) => {
  try {
    const { agencyId, clientId, text, attachments } = req.body;
    const message = await Message.create({
      agencyId: agencyId || req.user._id,
      clientId,
      senderId: req.user._id,
      text,
      attachments: attachments || []
    });

    return res.status(201).json({ message });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

module.exports = router;
