const express = require('express');
const router = express.Router();
const { runRecoveryAgent } = require('../services/aiService');

/**
 * POST /api/recovery-agent/run
 * Validates recovery case ID and runs Module 6 LangGraph Recovery Agent workflow.
 */
router.post('/run', async (req, res, next) => {
  try {
    const { recovery_case_id, is_demo, demo_simulate_success, initial_case, initial_payment, initial_customer } = req.body;

    if (!recovery_case_id && !initial_case) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PAYLOAD',
          message: 'Missing required field: recovery_case_id or initial_case object.'
        }
      });
    }

    const payload = {
      recovery_case_id: recovery_case_id || initial_case?.id || 'demo_case',
      is_demo: is_demo !== undefined ? Boolean(is_demo) : true,
      demo_simulate_success: demo_simulate_success !== undefined ? Boolean(demo_simulate_success) : true,
      initial_case,
      initial_payment,
      initial_customer
    };

    const aiResponse = await runRecoveryAgent(payload);

    res.status(200).json({
      success: true,
      data: aiResponse.data || aiResponse
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
