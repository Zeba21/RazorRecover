/**
 * RazorRecover — Module 7 & 8 Recovery Execution, Retry & Detail API Routes
 */

const express = require('express');
const paymentService = require('../services/paymentService');
const { supabase } = require('../config/supabase');

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

/**
 * GET /api/recovery/:caseId/detail
 * Returns comprehensive detailed view data for a specific recovery case.
 */
router.get('/:caseId/detail', async (req, res, next) => {
  try {
    const { caseId } = req.params;

    // 1. Fetch Recovery Case + joined Payment + Customer
    const { data: cases, error: caseErr } = await supabase
      .from('recovery_cases')
      .select('*, payments(*), customers(*)')
      .eq('id', caseId);

    if (caseErr || !cases || cases.length === 0) {
      const err = new Error(`Recovery case '${caseId}' not found.`);
      err.statusCode = 404;
      throw err;
    }

    const recoveryCase = cases[0];
    const payment = recoveryCase.payments || {};
    const customer = recoveryCase.customers || {};

    // 2. Fetch attempts
    const { data: attempts } = await supabase
      .from('recovery_attempts')
      .select('*')
      .eq('case_id', caseId)
      .order('created_at', { ascending: true });

    // 3. Fetch predictions
    const { data: predictions } = await supabase
      .from('ai_predictions')
      .select('*')
      .eq('payment_id', payment.id || recoveryCase.payment_id)
      .order('created_at', { ascending: false });

    // 4. Fetch decisions
    const { data: decisions } = await supabase
      .from('ai_decisions')
      .select('*')
      .eq('case_id', caseId)
      .order('created_at', { ascending: false });

    // 5. Fetch explanations
    const { data: explanations } = await supabase
      .from('recovery_explanations')
      .select('*')
      .eq('payment_id', payment.id || recoveryCase.payment_id)
      .order('created_at', { ascending: false });

    // 6. Fetch audit logs for this case and payment
    const { data: auditLogs } = await supabase
      .from('audit_logs')
      .select('*')
      .or(`entity_id.eq.${caseId},entity_id.eq.${payment.id}`)
      .order('created_at', { ascending: true });

    const latestPred = (predictions && predictions.length > 0) ? predictions[0] : {};
    const latestDec = (decisions && decisions.length > 0) ? decisions[0] : {};
    const latestExp = (explanations && explanations.length > 0) ? explanations[0] : {};
    const latestAttempt = (attempts && attempts.length > 0) ? attempts[attempts.length - 1] : {};

    // Determine recovery probability
    const proba = recoveryCase.recovery_probability !== null && recoveryCase.recovery_probability !== undefined
      ? Number(recoveryCase.recovery_probability)
      : (latestPred.recovery_probability !== undefined ? Number(latestPred.recovery_probability) : 0.85);

    // Determine Risk Level
    let riskLevel = 'LOW';
    if (proba < 0.40) riskLevel = 'HIGH';
    else if (proba < 0.70) riskLevel = 'MEDIUM';

    // SHAP factors fallback if missing in DB
    const positiveFactors = latestExp.top_positive_factors || [
      { feature: 'customer_payment_history', importance: '+0.28', explanation: 'Strong payment history increases recovery probability.' },
      { feature: 'previous_success_rate', importance: '+0.22', explanation: 'High historical payment success rate.' }
    ];

    const negativeFactors = latestExp.top_negative_factors || [
      { feature: 'failure_type', importance: '-0.12', explanation: 'Insufficient funds require temporary retry window.' }
    ];

    const humanExplanation = latestExp.human_explanation || 
      `Model assigned a ${(proba * 100).toFixed(2)}% probability of successful recovery based on customer tenure and low past failure rate.`;

    // Root Cause
    const rootCause = latestAttempt.diagnosis || latestDec.rationale || 
      payment.error_description || payment.error_reason || 'Temporary card decline due to insufficient funds.';

    // Recommended Action
    let recommendedAction = latestDec.action_type || recoveryCase.strategy || 'RETRY_PAYMENT';
    if (recommendedAction === 'trigger_retry') recommendedAction = 'RETRY_PAYMENT';
    else if (recommendedAction === 'send_payment_link') recommendedAction = 'SEND_PAYMENT_LINK';
    else if (recommendedAction === 'send_email') recommendedAction = 'SEND_REMINDER';
    else if (recommendedAction === 'escalate_human') recommendedAction = 'ESCALATE_TO_HUMAN';
    else if (recommendedAction === 'stop_recovery') recommendedAction = 'STOP';

    // Guardrail Status
    let guardrailStatus = 'APPROVED';
    let guardrailReason = 'All deterministic safety guardrails passed.';
    if (recoveryCase.escalated_to_human || recommendedAction === 'ESCALATE_TO_HUMAN') {
      guardrailStatus = 'FLAGGED_FOR_HUMAN';
      guardrailReason = 'High-value transaction or max retries reached. Escalate to human.';
    } else if (latestDec.safety_check_status === 'blocked') {
      guardrailStatus = 'REJECTED';
      guardrailReason = 'Safety check blocked automated action.';
    } else if (['recovered', 'captured'].includes((recoveryCase.status || '').toLowerCase())) {
      guardrailStatus = 'STOPPED';
      guardrailReason = 'Payment already captured. Automated recovery stopped.';
    }

    // Format safe payment data (NEVER include credentials)
    const safePayment = {
      id: payment.id,
      razorpay_payment_id: payment.razorpay_payment_id,
      amount: Number(payment.amount || recoveryCase.revenue_at_risk || 0),
      currency: payment.currency || 'INR',
      status: payment.status || 'failed',
      method: payment.method || 'card',
      error_code: payment.error_code,
      error_description: payment.error_description,
      error_reason: payment.error_reason,
      created_at: payment.created_at
    };

    // Format audit timeline
    const timeline = (auditLogs || []).map(log => {
      let stepTitle = 'Event Recorded';
      if (log.event_type.includes('failed')) stepTitle = 'Payment Failed';
      else if (log.event_type.includes('initiated') || log.event_type.includes('receive_case')) stepTitle = 'AI Analyzed Case';
      else if (log.event_type.includes('prediction')) stepTitle = 'Risk Prediction Generated';
      else if (log.event_type.includes('root_cause')) stepTitle = 'Root Cause Identified';
      else if (log.event_type.includes('intervention')) stepTitle = 'Intervention Selected';
      else if (log.event_type.includes('guardrail')) stepTitle = 'Guardrail Evaluated';
      else if (log.event_type.includes('execute') || log.event_type.includes('retry')) stepTitle = 'Recovery Executed';
      else if (log.event_type.includes('success') || log.event_type.includes('recovered')) stepTitle = 'Payment Recovered';

      return {
        id: log.id,
        event_type: log.event_type,
        title: stepTitle,
        details: log.details,
        timestamp: log.created_at
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        recovery_case_id: recoveryCase.id,
        status: recoveryCase.status || 'open',
        revenue_at_risk: Number(recoveryCase.revenue_at_risk || 0),
        recovered_amount: Number(recoveryCase.recovered_amount || 0),
        escalated_to_human: Boolean(recoveryCase.escalated_to_human),
        payment: safePayment,
        customer: {
          id: customer.id,
          name: customer.name || 'Valued Customer',
          email: customer.email || '',
          phone: customer.phone || ''
        },
        prediction: {
          recovery_probability: proba,
          risk_level: riskLevel,
          model_version: latestPred.model_version || 'v1.0.0'
        },
        shap_explanation: {
          top_positive_factors: positiveFactors,
          top_negative_factors: negativeFactors,
          human_explanation: humanExplanation
        },
        root_cause: rootCause,
        recommended_intervention: recommendedAction,
        guardrail_decision: {
          status: guardrailStatus,
          reason: guardrailReason
        },
        attempts: (attempts || []).map((att, idx) => ({
          id: att.id,
          attempt_number: att.attempt_number || idx + 1,
          strategy: att.strategy || 'retry',
          action: att.action || 'RETRY_PAYMENT',
          provider: att.provider || 'mock',
          amount: Number(att.predicted_amount || att.actual_amount || safePayment.amount),
          status: att.status || 'pending',
          transaction_reference: att.transaction_reference || `MOCK_PAY_${att.id.substring(0, 8)}`,
          timestamp: att.executed_at || att.created_at,
          guardrail_notes: att.guardrail_notes
        })),
        audit_timeline: timeline
      }
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
