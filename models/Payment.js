// backend/models/Payment.js
const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  agencyId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  approvalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Approval' },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'NGN' },
  status: { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending' },
  paystackReference: { type: String, unique: true, sparse: true },
  paystackAccessCode: { type: String },
  description: { type: String },
  paidAt: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('Payment', paymentSchema);
