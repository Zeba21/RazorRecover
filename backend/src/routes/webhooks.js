/**
 * RazorRecover — Module 7 Mock Webhook Handler Routes
 */

const express = require('express');
const paymentService = require('../services/paymentService');
const { createRateLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

const webhookRateLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 50, message: 'Webhook rate limit exceeded.' });

router.use('/mock-payment', webhookRateLimiter);

/**
 * POST /api/webhooks/mock-payment
 * Receives simulated webhook payment events: payment.success, payment.failed, payment.pending, payment.cancelled
 */
router.post('/mock-payment', async (req, res, next) => {
  try {
    const {
      event,
      payload,
      idempotency_key,
      event_id
    } = req.body || {};

    const result = await paymentService.processWebhookEvent({
      event,
      payload: payload || req.body,
      idempotency_key,
      event_id
    });

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
