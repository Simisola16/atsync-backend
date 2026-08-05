// backend/models/IntakeSubmission.js
const mongoose = require('mongoose');

const intakeSubmissionSchema = new mongoose.Schema({
  agencyId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  clientName: { type: String, required: true },
  clientEmail: { type: String, required: true },
  companyName: { type: String },
  projectTitle: { type: String },
  projectScope: { type: String },
  budget: { type: String },
  timeline: { type: String },
  notes: { type: String },
  responses: { type: mongoose.Schema.Types.Mixed, default: {} },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' }
}, { timestamps: true });

module.exports = mongoose.model('IntakeSubmission', intakeSubmissionSchema);
