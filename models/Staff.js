// backend/models/Staff.js
const mongoose = require('mongoose');

const staffSchema = new mongoose.Schema({
  agencyId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  email: { type: String, required: true },
  role: { type: String, enum: ['editor', 'viewer'], default: 'editor' },
  status: { type: String, enum: ['invited', 'active'], default: 'invited' },
  invitedAt: { type: Date, default: Date.now },
  joinedAt: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('Staff', staffSchema);
