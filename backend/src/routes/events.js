const express = require('express');
const { validateEvent, processEvent } = require('../services/eventEngine');

const router = express.Router();

/**
 * POST /api/events
 * Ingests a billing/payment event, calculates revenue at risk,
 * creates/updates recovery cases, and writes to audit logs.
 */
router.post('/', async (req, res, next) => {
  try {
    // 1. Validate the event payload
    await validateEvent(req.body);

    // 2. Process the event
    const result = await processEvent(req.body, { isDemo: false });

    // 3. Return successful API response
    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    // Pass errors to the central Express error handler
    return next(error);
  }
});

module.exports = router;
