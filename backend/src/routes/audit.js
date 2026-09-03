const express = require('express');
const { supabase } = require('../config/supabase');

const router = express.Router();

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/**
 * GET /api/audit
 * Audit Explorer API endpoint.
 * Returns paginated, searchable, filterable real audit logs from Supabase.
 */
router.get('/', async (req, res, next) => {
  try {
    const { search, case_id, action, guardrail_result, page = 1, limit = 20 } = req.query;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);

    if (isNaN(pageNum) || pageNum < 1) {
      const err = new Error('Invalid page parameter. Must be a positive integer.');
      err.statusCode = 400;
      throw err;
    }

    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      const err = new Error('Invalid limit parameter. Must be an integer between 1 and 100.');
      err.statusCode = 400;
      throw err;
    }

    if (case_id && !UUID_REGEX.test(case_id)) {
      const err = new Error(`Invalid case_id '${case_id}'. Must be a valid UUID.`);
      err.statusCode = 400;
      throw err;
    }

    // Query audit_logs table from database
    let query = supabase
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (case_id) {
      query = query.or(`entity_id.eq.${case_id},details->>case_id.eq.${case_id}`);
    }

    const { data: rawLogs, error, count } = await query;

    if (error) {
      const err = new Error(`Database error fetching audit logs: ${error.message}`);
      err.statusCode = 500;
      throw err;
    }

    let logs = (rawLogs || []).map(log => {
      const details = log.details || {};

      let caseId = details.case_id || (log.entity_type === 'recovery_case' ? log.entity_id : null);
      let actionName = details.action || details.recommended_action || details.enforced_action || details.final_action || log.event_type;
      if (actionName === 'payment_failed') actionName = 'PAYMENT_FAILED';
      else if (actionName === 'revenue_recovered' || actionName === 'payment_success') actionName = 'RECOVERY_SUCCESS';

      let reasonText = details.reason || details.guardrail_notes || details.rationale || log.event_type.replace(/_/g, ' ');
      let aiRecommendation = details.ai_recommendation || details.recommended_action || details.strategy || 'N/A';
      
      let guardrailRes = details.guardrail_status || details.decision || (log.severity === 'warning' ? 'REJECTED' : 'APPROVED');
      if (log.event_type.includes('guardrail')) {
        guardrailRes = details.decision || details.guardrail_status || 'EVALUATED';
      }

      let executionRes = details.status || (['payment_success', 'revenue_recovered'].includes(log.event_type) ? 'SUCCESS' : (log.event_type === 'payment_failed' ? 'FAILED' : 'PROCESSED'));
      let amountVal = details.amount !== undefined ? Number(details.amount) : (details.txAmount !== undefined ? Number(details.txAmount) : (details.recovered_amount !== undefined ? Number(details.recovered_amount) : 0));

      return {
        id: log.id,
        timestamp: log.created_at,
        case_id: caseId || log.entity_id || 'N/A',
        action: String(actionName).toUpperCase(),
        reason: reasonText,
        ai_recommendation: String(aiRecommendation).toUpperCase(),
        guardrail_result: String(guardrailRes).toUpperCase(),
        execution_result: String(executionRes).toUpperCase(),
        amount: Math.round(amountVal * 100) / 100,
        actor: log.actor || 'system',
        system_version: details.system_version || 'v1.0.0-xgboost',
        event_type: log.event_type,
        severity: log.severity
      };
    });

    // Apply search filter
    if (search && search.trim() !== '') {
      const q = search.trim().toLowerCase();
      logs = logs.filter(l =>
        (l.case_id && l.case_id.toLowerCase().includes(q)) ||
        (l.action && l.action.toLowerCase().includes(q)) ||
        (l.reason && l.reason.toLowerCase().includes(q)) ||
        (l.actor && l.actor.toLowerCase().includes(q)) ||
        (l.event_type && l.event_type.toLowerCase().includes(q))
      );
    }

    // Apply action filter
    if (action && action.toLowerCase() !== 'all') {
      const act = action.toUpperCase();
      logs = logs.filter(l => l.action.includes(act));
    }

    // Apply guardrail result filter
    if (guardrail_result && guardrail_result.toLowerCase() !== 'all') {
      const gRes = guardrail_result.toUpperCase();
      logs = logs.filter(l => l.guardrail_result === gRes || l.guardrail_result.includes(gRes));
    }

    // Pagination
    const totalCount = logs.length;
    const totalPages = Math.ceil(totalCount / limitNum) || 1;
    const startIndex = (pageNum - 1) * limitNum;
    const paginatedLogs = logs.slice(startIndex, startIndex + limitNum);

    return res.status(200).json({
      success: true,
      data: {
        logs: paginatedLogs,
        pagination: {
          total: totalCount,
          page: pageNum,
          limit: limitNum,
          total_pages: totalPages
        }
      }
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
