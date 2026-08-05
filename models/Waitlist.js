// backend/models/Waitlist.js
const mongoose = require('mongoose');

const waitlistSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  status: { type: String, default: 'waiting' }
}, { timestamps: true });

module.exports = mongoose.model('Waitlist', waitlistSchema);
