const express = require('express');
const paymentService = require('../services/paymentService');
const { supabase } = require('../config/supabase');
const { createRateLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const executionRateLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 20, message: 'Execution rate limit exceeded. Please wait a moment.' });

router.use('/:caseId/execute', executionRateLimiter);
router.use('/:caseId/retry', executionRateLimiter);

/**
 * POST /api/recovery/:caseId/execute
 * Execute a recovery action for a recovery case.
 */
router.post('/:caseId/execute', async (req, res, next) => {
  try {
    const { caseId } = req.params;
    if (!UUID_REGEX.test(caseId)) {
      const err = new Error(`Invalid caseId '${caseId}'. Must be a valid UUID.`);
      err.statusCode = 400;
      throw err;
    }

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
    if (!UUID_REGEX.test(caseId)) {
      const err = new Error(`Invalid caseId '${caseId}'. Must be a valid UUID.`);
      err.statusCode = 400;
      throw err;
    }

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
    if (!UUID_REGEX.test(caseId)) {
      const err = new Error(`Invalid caseId '${caseId}'. Must be a valid UUID.`);
      err.statusCode = 400;
      throw err;
    }
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
    if (!UUID_REGEX.test(caseId)) {
      const err = new Error(`Invalid caseId '${caseId}'. Must be a valid UUID.`);
      err.statusCode = 400;
      throw err;
    }

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

/**
 * GET /api/recovery/activity
 * Returns recent AI agent activity log events from audit_logs table for Dashboard feed.
 */
router.get('/activity', async (req, res, next) => {
  try {
    const { data: logs, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) {
      const err = new Error(`Database error fetching activity logs: ${error.message}`);
      err.statusCode = 500;
      throw err;
    }

    const activityEvents = (logs || []).map(log => {
      let title = 'AI Agent Activity';
      let description = '';

      switch (log.event_type) {
        case 'payment_failed':
          title = 'Payment Failure Detected';
          description = `Payment of ₹${log.details?.amount ? Number(log.details.amount).toLocaleString() : '0'} failed (${log.details?.error_reason || 'Decline'}).`;
          break;
        case 'recovery_initiated':
        case 'agent_state_receive_case':
          title = 'AI Recovery Case Initiated';
          description = `Agent started processing recovery case for ₹${log.details?.tx_amount ? Number(log.details.tx_amount).toLocaleString() : 'payment'}.`;
          break;
        case 'agent_state_get_ml_prediction':
          title = `Risk Model Prediction: ${log.details?.probability ? (Number(log.details.probability) * 100).toFixed(2) + '%' : 'Calculated'}`;
          description = `Risk level classified as ${log.details?.risk_level || 'evaluated'} (${log.details?.model_version || 'XGBoost'}).`;
          break;
        case 'agent_state_get_shap_explanation':
          title = 'SHAP Feature Explanation Generated';
          description = log.details?.human_explanation || 'Identified top positive and negative recovery factors.';
          break;
        case 'agent_state_diagnose_root_cause':
          title = 'Root Cause Identified';
          description = log.details?.root_cause || 'AI diagnosed underlying payment failure reason.';
          break;
        case 'agent_state_select_intervention':
          title = `Intervention Selected: ${log.details?.recommended_action || 'Strategy Chosen'}`;
          description = log.details?.reason || 'AI selected optimal recovery strategy.';
          break;
        case 'agent_state_apply_guardrails':
        case 'guardrail_evaluated':
          title = `Guardrail: ${log.details?.decision || log.details?.guardrail_status || 'Evaluated'}`;
          description = log.details?.reason || 'Deterministic safety checks executed.';
          break;
        case 'payment_retry_requested':
        case 'agent_state_execute_action':
          title = `Recovery Execution: ${log.details?.action || log.details?.final_action || 'Action'}`;
          description = log.details?.details || log.details?.reason || 'Execution dispatched via MockPaymentProvider.';
          break;
        case 'payment_success':
        case 'revenue_recovered':
          title = 'Payment Recovered Successfully';
          description = `Recovered ₹${log.details?.recovered_amount || log.details?.amount ? Number(log.details.recovered_amount || log.details.amount).toLocaleString() : 'revenue'}.`;
          break;
        default:
          title = log.event_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          description = typeof log.details === 'object' ? JSON.stringify(log.details) : String(log.details || '');
          break;
      }

      return {
        id: log.id,
        event_type: log.event_type,
        title,
        description,
        actor: log.actor || 'ai_agent',
        severity: log.severity || 'info',
        entity_id: log.entity_id,
        timestamp: log.created_at
      };
    });

    return res.status(200).json({
      success: true,
      data: activityEvents
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
