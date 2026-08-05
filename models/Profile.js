// backend/models/Profile.js
const mongoose = require('mongoose');

const profileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  agencyName: { type: String },
  email: { type: String },
  cityCountry: { type: String },
  description: { type: String },
  teamSize: { type: String },
  yearsOperating: { type: String },
  services: [{ type: String }],
  popularService: { type: String },
  notOfferedServices: { type: String },
  minBudget: { type: String },
  depositRequired: { type: String },
  turnaroundTime: { type: String },
  maxProjects: { type: String },
  responseTime: { type: String },
  process: { type: String },
  tone: { type: String },
  neverSay: { type: String },
  delayReasons: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Profile', profileSchema);
