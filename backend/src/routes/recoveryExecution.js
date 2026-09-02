/**
 * RazorRecover — Module 7 Recovery Execution & Retry API Routes
 */

const express = require('express');
const paymentService = require('../services/paymentService');

const router = express.Router();

/**
 * POST /api/recovery/:caseId/execute
 * Execute a recovery action for a recovery case.
 */
router.post('/:caseId/execute', async (req, res, next) => {
  try {
    const { caseId } = req.params;
    const {
      action = 'RETRY_PAYMENT',
      simulate_success = true,
      simulate_status,
      idempotency_key
    } = req.body || {};

    const result = await paymentService.executeRecoveryAction(caseId, {
      action,
      simulate_success,
      simulate_status,
      idempotency_key
    });

    return res.status(200).json({
      success: result.success !== false,
      data: result
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /api/recovery/:caseId/retry
 * Convenience endpoint for retrying payment on a recovery case.
 */
router.post('/:caseId/retry', async (req, res, next) => {
  try {
    const { caseId } = req.params;
    const {
      simulate_success = true,
      simulate_status,
      idempotency_key
    } = req.body || {};

    const result = await paymentService.executeRecoveryAction(caseId, {
      action: 'RETRY_PAYMENT',
      simulate_success,
      simulate_status,
      idempotency_key
    });

    return res.status(200).json({
      success: result.success !== false,
      data: result
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /api/recovery/:caseId/status
 * Get comprehensive recovery case status, attempts, and audit logs.
 */
router.get('/:caseId/status', async (req, res, next) => {
  try {
    const { caseId } = req.params;
    const result = await paymentService.getCaseStatus(caseId);
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
