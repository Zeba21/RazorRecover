const express = require('express');
const { supabase } = require('../config/supabase');
const { processEvent } = require('../services/eventEngine');
const { createRateLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

const demoRateLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 20, message: 'Demo rate limit exceeded.' });

/**
 * POST /api/demo/payment-failure
 * Generates a realistic PAYMENT_FAILED event, runs it through the Event Engine,
 * and returns details of the processed event, payment, recovery case, and audit log.
 */
router.post('/payment-failure', demoRateLimiter, async (req, res, next) => {
  try {
    // 1. Fetch an existing customer from the database
    const { data: customers, error: customerError } = await supabase
      .from('customers')
      .select('id')
      .limit(1);

    if (customerError) {
      const err = new Error(`Failed to retrieve demo customer: ${customerError.message}`);
      err.statusCode = 500;
      throw err;
    }

    const customerId = (customers && customers.length > 0)
      ? customers[0].id
      : '00000000-0000-0000-0000-000000000001';

    // 2. Generate a realistic failed-payment event
    const demoEvent = {
      event_type: 'PAYMENT_FAILED',
      customer_id: customerId,
      payment_reference: `pay_demo_${Date.now()}`,
      amount: (req.body && typeof req.body.amount === 'number' && req.body.amount > 0) ? req.body.amount : 12500.00,
      timestamp: new Date().toISOString(),
      metadata: {
        currency: 'INR',
        error_code: 'bad_request_payment_declined_by_bank',
        error_description: 'The card has insufficient funds',
        error_reason: 'insufficient_funds',
        error_source: 'customer',
        error_step: 'payment_processing',
        gateway: 'razorpay',
        method: 'card',
        is_demo: true
      }
    };

    // 3. Process the event using the same event engine flow
    const result = await processEvent(demoEvent, { isDemo: true });

    // 4. Return the detailed response
    return res.status(200).json({
      success: true,
      data: {
        event_id: result.event_id,
        event_type: result.event_type,
        customer_id: customerId,
        amount: demoEvent.amount,
        revenue_at_risk: result.revenue_at_risk,
        recovery_case_id: result.recovery_case_id,
        status: result.status
      }
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
