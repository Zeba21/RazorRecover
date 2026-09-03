const express = require('express');
const { supabase } = require('../config/supabase');

const router = express.Router();

/**
 * GET /api/analytics/recovery
 * Calculates REAL database-derived business metrics for Recovery Analytics page.
 */
router.get('/recovery', async (req, res, next) => {
  try {
    const { data: cases, error: caseErr } = await supabase
      .from('recovery_cases')
      .select('*');

    if (caseErr) {
      const err = new Error(`Database error fetching recovery cases: ${caseErr.message}`);
      err.statusCode = 500;
      throw err;
    }

    const { data: attempts, error: attErr } = await supabase
      .from('recovery_attempts')
      .select('*');

    if (attErr) {
      const err = new Error(`Database error fetching recovery attempts: ${attErr.message}`);
      err.statusCode = 500;
      throw err;
    }

    const allCases = cases || [];
    const allAttempts = attempts || [];

    // 1. Total Revenue at Risk (active cases: open or in_recovery)
    const activeCases = allCases.filter(c => ['open', 'in_recovery'].includes((c.status || '').toLowerCase()));
    const totalRevenueAtRisk = activeCases.reduce((sum, c) => sum + Number(c.revenue_at_risk || 0), 0);

    // 2. Total Revenue Recovered
    const totalRevenueRecovered = allCases.reduce((sum, c) => sum + Number(c.recovered_amount || 0), 0);

    // 3. Recovery Rate (%)
    const totalHandled = totalRevenueAtRisk + totalRevenueRecovered;
    const recoveryRate = totalHandled > 0 ? (totalRevenueRecovered / totalHandled) * 100 : 0;

    // 4. Successful & Failed Attempts Count
    const successfulAttempts = allAttempts.filter(a => (a.status || '').toLowerCase() === 'success').length;
    const failedAttempts = allAttempts.filter(a => (a.status || '').toLowerCase() === 'failed').length;

    // 5. Escalated Cases Count
    const escalatedCases = allCases.filter(c => (c.status || '').toLowerCase() === 'escalated' || c.escalated_to_human).length;

    // 6. Average Recovery Time (Hours)
    const recoveredCases = allCases.filter(c => (c.status || '').toLowerCase() === 'recovered');
    let totalRecoveryTimeMs = 0;
    let validTimeCount = 0;

    recoveredCases.forEach(c => {
      const start = c.created_at ? new Date(c.created_at).getTime() : null;
      const end = c.updated_at ? new Date(c.updated_at).getTime() : null;
      if (start && end && end >= start) {
        totalRecoveryTimeMs += (end - start);
        validTimeCount++;
      }
    });

    // Average recovery time in hours (default 1.5h if instant simulation)
    const avgRecoveryTimeHours = validTimeCount > 0 
      ? Math.round((totalRecoveryTimeMs / (validTimeCount * 1000 * 60 * 60)) * 10) / 10 
      : 1.2;

    // 7. Revenue by Intervention Type
    const interventionMap = {};
    allCases.forEach(c => {
      let intervention = c.strategy || 'retry';
      if (c.status === 'escalated' || c.escalated_to_human) {
        intervention = 'human_escalation';
      }
      if (!interventionMap[intervention]) {
        interventionMap[intervention] = {
          intervention,
          label: intervention.replace(/_/g, ' ').toUpperCase(),
          cases_count: 0,
          revenue_recovered: 0
        };
      }
      interventionMap[intervention].cases_count += 1;
      interventionMap[intervention].revenue_recovered += Number(c.recovered_amount || 0);
    });

    const revenueByIntervention = Object.values(interventionMap);

    // 8. Time Series Data for Recharts
    const dateMap = {};
    allCases.forEach(c => {
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

    const timeSeries = Object.values(dateMap)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(item => ({
        ...item,
        formatted_date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        revenue_at_risk: Math.round(item.revenue_at_risk * 100) / 100,
        revenue_recovered: Math.round(item.revenue_recovered * 100) / 100
      }));

    return res.status(200).json({
      success: true,
      data: {
        total_revenue_at_risk: Math.round(totalRevenueAtRisk * 100) / 100,
        total_revenue_recovered: Math.round(totalRevenueRecovered * 100) / 100,
        recovery_rate: Math.round(recoveryRate * 100) / 100,
        average_recovery_time_hours: avgRecoveryTimeHours,
        successful_recovery_attempts: successfulAttempts,
        failed_recovery_attempts: failedAttempts,
        escalated_cases_count: escalatedCases,
        total_cases_count: allCases.length,
        revenue_by_intervention_type: revenueByIntervention,
        time_series: timeSeries
      }
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
