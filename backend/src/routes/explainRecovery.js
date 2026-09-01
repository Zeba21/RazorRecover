const express = require('express');
const { explainRecovery } = require('../services/aiService');
const { supabase } = require('../config/supabase');

const router = express.Router();

/**
 * POST /api/explain-recovery
 * Express route for predicting recovery probability AND generating SHAP explainability
 * via the Python FastAPI AI service, and storing the prediction/explanation in Supabase.
 */
router.post('/', async (req, res, next) => {
  try {
    // 1. Forward request payload to FastAPI /explain-recovery
    const explanationResult = await explainRecovery(req.body);

    // 2. Persist prediction and SHAP explanation in Supabase recovery_explanations table
    try {
      await supabase
        .from('recovery_explanations')
        .insert({
          payment_id: req.body.payment_id || null,
          transaction_amount: req.body.transaction_amount,
          recovery_probability: explanationResult.recovery_probability,
          risk_level: explanationResult.risk_level,
          model_version: explanationResult.model_version,
          top_positive_factors: explanationResult.top_positive_factors,
          top_negative_factors: explanationResult.top_negative_factors,
          feature_importance: explanationResult.feature_importance,
          human_explanation: explanationResult.human_explanation
        });
    } catch (dbErr) {
      console.warn('⚠️ Could not persist explanation to Supabase:', dbErr.message);
      // Non-blocking for response return if DB connection is unavailable
    }

    // 3. Return structured explanation response to client
    return res.status(200).json({
      success: true,
      data: explanationResult
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
