const express = require('express');
const { supabase } = require('../config/supabase');

const router = express.Router();

/**
 * Helper to determine risk level based on recovery probability.
 */
function getRiskLevel(probability) {
  if (probability === null || probability === undefined) return 'UNKNOWN';
  const prob = Number(probability);
  if (prob < 0.40) return 'HIGH';
  if (prob < 0.70) return 'MEDIUM';
  return 'LOW';
}

/**
 * GET /api/dashboard/summary
 * Returns top KPI metrics calculated directly from Supabase database tables.
 */
router.get('/summary', async (req, res, next) => {
  try {
    const { data: cases, error: casesErr } = await supabase
      .from('recovery_cases')
      .select('status, revenue_at_risk, recovered_amount, recovery_probability');

    if (casesErr) {
      const err = new Error(`Database error fetching recovery cases: ${casesErr.message}`);
      err.statusCode = 500;
      throw err;
    }

    const { data: attempts, error: attErr } = await supabase
      .from('recovery_attempts')
      .select('id, status');

    if (attErr) {
      const err = new Error(`Database error fetching recovery attempts: ${attErr.message}`);
      err.statusCode = 500;
      throw err;
    }

    const allCases = cases || [];
    const allAttempts = attempts || [];

    // Active cases: status 'open' or 'in_recovery'
    const activeCases = allCases.filter(c => ['open', 'in_recovery'].includes((c.status || '').toLowerCase()));
    const recoveredCases = allCases.filter(c => (c.status || '').toLowerCase() === 'recovered');
    const failedCases = allCases.filter(c => ['failed', 'escalated'].includes((c.status || '').toLowerCase()));

    // Total Revenue at Risk (active cases)
    const revenueAtRisk = activeCases.reduce((sum, c) => sum + Number(c.revenue_at_risk || 0), 0);

    // Total Revenue Recovered
    const revenueRecovered = allCases.reduce((sum, c) => sum + Number(c.recovered_amount || 0), 0);

    // Total handled revenue
    const totalHandled = revenueAtRisk + revenueRecovered;

    // Recovery Rate %
    const recoveryRate = totalHandled > 0 ? (revenueRecovered / totalHandled) * 100 : 0;

    return res.status(200).json({
      success: true,
      data: {
        revenue_at_risk: Math.round(revenueAtRisk * 100) / 100,
        revenue_recovered: Math.round(revenueRecovered * 100) / 100,
        recovery_rate: Math.round(recoveryRate * 100) / 100,
        active_cases_count: activeCases.length,
        total_cases_count: allCases.length,
        recovered_cases_count: recoveredCases.length,
        failed_cases_count: failedCases.length,
        total_attempts_count: allAttempts.length
      }
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /api/dashboard/revenue
 * Returns time-series aggregated revenue data for Recharts line/area chart.
 */
router.get('/revenue', async (req, res, next) => {
  try {
    const { data: cases, error } = await supabase
      .from('recovery_cases')
      .select('id, created_at, status, revenue_at_risk, recovered_amount')
      .order('created_at', { ascending: true });

    if (error) {
      const err = new Error(`Database error fetching revenue data: ${error.message}`);
      err.statusCode = 500;
      throw err;
    }

    // Group by date (YYYY-MM-DD)
    const dateMap = {};

    (cases || []).forEach(c => {
      const dateStr = c.created_at ? c.created_at.substring(0, 10) : new Date().toISOString().substring(0, 10);
      if (!dateMap[dateStr]) {
        dateMap[dateStr] = {
          date: dateStr,
          revenue_at_risk: 0,
          revenue_recovered: 0
        };
      }
      if (['open', 'in_recovery'].includes((c.status || '').toLowerCase())) {
        dateMap[dateStr].revenue_at_risk += Number(c.revenue_at_risk || 0);
      }
      dateMap[dateStr].revenue_recovered += Number(c.recovered_amount || 0);
    });

    // Convert map to sorted array
    let timeSeries = Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date));

    // Format dates for display
    timeSeries = timeSeries.map(item => {
      const d = new Date(item.date);
      const formattedDate = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return {
        ...item,
        formatted_date: formattedDate,
        revenue_at_risk: Math.round(item.revenue_at_risk * 100) / 100,
        revenue_recovered: Math.round(item.revenue_recovered * 100) / 100
      };
    });

    return res.status(200).json({
      success: true,
      data: timeSeries
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /api/dashboard/cases
 * Returns recovery cases with joined payments, customers, predictions, and decisions.
 * Supports query parameters: search, status, risk.
 */
router.get('/cases', async (req, res, next) => {
  try {
    const { search, status, risk } = req.query;

    const { data: cases, error } = await supabase
      .from('recovery_cases')
      .select(`
        *,
        payments (*),
        customers (name, email)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      const err = new Error(`Database error fetching recovery cases: ${error.message}`);
      err.statusCode = 500;
      throw err;
    }

    // Fetch latest predictions and decisions
    const { data: predictions } = await supabase.from('ai_predictions').select('*');
    const { data: decisions } = await supabase.from('ai_decisions').select('*');

    const predMap = {};
    (predictions || []).forEach(p => {
      predMap[p.payment_id] = p;
    });

    const decMap = {};
    (decisions || []).forEach(d => {
      decMap[d.case_id] = d;
    });

    let enrichedCases = (cases || []).map(c => {
      const payment = c.payments || {};
      const customer = c.customers || {};
      const pred = predMap[payment.id] || {};
      const dec = decMap[c.id] || {};

      const proba = c.recovery_probability !== null && c.recovery_probability !== undefined 
        ? Number(c.recovery_probability) 
        : (pred.recovery_probability !== undefined ? Number(pred.recovery_probability) : null);

      const riskLevel = getRiskLevel(proba);

      let failureReason = payment.error_description || payment.error_reason || payment.error_code || 'Payment Failure';
      if (failureReason === 'insufficient_funds') failureReason = 'Insufficient Funds';
      else if (failureReason === 'authentication_failed') failureReason = 'Authentication Failed';
      else if (failureReason === 'gateway_error') failureReason = 'Gateway Timeout / Error';

      // Map action type to human readable action
      let action = dec.action_type || c.strategy || 'RETRY_PAYMENT';
      if (action === 'trigger_retry') action = 'RETRY_PAYMENT';
      else if (action === 'send_payment_link') action = 'SEND_PAYMENT_LINK';
      else if (action === 'send_email') action = 'SEND_REMINDER';
      else if (action === 'escalate_human') action = 'ESCALATE_TO_HUMAN';
      else if (action === 'stop_recovery') action = 'STOP';

      return {
        id: c.id,
        payment_id: c.payment_id,
        customer_name: customer.name || 'Unknown Customer',
        customer_email: customer.email || '',
        amount: Number(payment.amount || c.revenue_at_risk || 0),
        recovered_amount: Number(c.recovered_amount || 0),
        failure_reason: failureReason,
        recovery_probability: proba,
        risk: riskLevel,
        ai_recommended_action: action,
        status: c.status || 'open',
        created_at: c.created_at,
        updated_at: c.updated_at
      };
    });

    // Apply search filter
    if (search && search.trim() !== '') {
      const q = search.trim().toLowerCase();
      enrichedCases = enrichedCases.filter(c =>
        c.customer_name.toLowerCase().includes(q) ||
        c.customer_email.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q) ||
        (c.payment_id && c.payment_id.toLowerCase().includes(q))
      );
    }

    // Apply status filter
    if (status && status.toLowerCase() !== 'all') {
      const s = status.toLowerCase();
      enrichedCases = enrichedCases.filter(c => (c.status || '').toLowerCase() === s);
    }

    // Apply risk filter
    if (risk && risk.toLowerCase() !== 'all') {
      const r = risk.toUpperCase();
      enrichedCases = enrichedCases.filter(c => c.risk === r);
    }

    return res.status(200).json({
      success: true,
      data: enrichedCases
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /api/recovery/activity
 * Returns recent AI agent activity log events from audit_logs table.
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
          const rawDet = log.details?.details;
          description = (typeof rawDet === 'object' && rawDet !== null)
            ? (rawDet.details || rawDet.execution_status || JSON.stringify(rawDet))
            : (rawDet || log.details?.reason || 'Execution dispatched via MockPaymentProvider.');
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
