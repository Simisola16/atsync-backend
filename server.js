// backend/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const waitlistRoutes = require('./routes/waitlist');
const paymentsRoutes = require('./routes/payments');

const app = express();

app.use(cors({ origin: true, credentials: true }));

// Store raw body buffer on req.rawBody so the Paystack webhook can verify HMAC.
// This is the standard approach when you need both parsed JSON and raw bytes.
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: true }));

// Health Check endpoint (very useful for Render deployment to stay active)
app.get('/health', (_req, res) => {
  res.status(200).send('OK');
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/waitlist', waitlistRoutes);
app.use('/api/payments', paymentsRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
