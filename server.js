// backend/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

const authRoutes = require('./routes/auth');
const waitlistRoutes = require('./routes/waitlist');
const paymentsRoutes = require('./routes/payments');
const inboxRoutes = require('./routes/inbox');
const workspaceRoutes = require('./routes/workspace');
const intakeRoutes = require('./routes/intake');
const approvalsRoutes = require('./routes/approvals');
const chatRoutes = require('./routes/chat');

const app = express();

// Connect to MongoDB
connectDB();

app.use(cors({ origin: true, credentials: true }));

// Raw body parser for Paystack webhook HMAC verification
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (_req, res) => {
  res.status(200).send('OK');
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/waitlist', waitlistRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/inbox', inboxRoutes);
app.use('/api/workspace', workspaceRoutes);
app.use('/api/intake', intakeRoutes);
app.use('/api/approvals', approvalsRoutes);
app.use('/api/chat', chatRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
