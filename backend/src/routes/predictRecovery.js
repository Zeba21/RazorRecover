const express = require('express');
const { predictRecovery } = require('../services/aiService');

const router = express.Router();

/**
 * POST /api/predict-recovery
 * Express route for predicting recovery probability via the AI FastAPI service.
 */
router.post('/', async (req, res, next) => {
  try {
    const prediction = await predictRecovery(req.body);
    return res.status(200).json({
      success: true,
      data: prediction
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
