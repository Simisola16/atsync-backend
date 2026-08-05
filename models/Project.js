// backend/models/Project.js
const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  agencyId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  intakeSubmissionId: { type: mongoose.Schema.Types.ObjectId, ref: 'IntakeSubmission' },
  title: { type: String, required: true },
  description: { type: String },
  status: { type: String, enum: ['active', 'in_review', 'completed', 'paused'], default: 'active' },
  budget: { type: Number, default: 0 },
  deadline: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('Project', projectSchema);
