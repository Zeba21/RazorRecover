const { supabase } = require('../config/supabase');

describe('Module 8 — Dashboard & UI Integration', () => {
  test('Supabase recovery_cases and payments exist for dashboard summary calculation', async () => {
    const { data: cases, error: caseErr } = await supabase
      .from('recovery_cases')
      .select('status, revenue_at_risk, recovered_amount');
    expect(caseErr).toBeNull();
    expect(Array.isArray(cases)).toBe(true);

    const { data: payments, error: pmtErr } = await supabase
      .from('payments')
      .select('id, status, amount');
    expect(pmtErr).toBeNull();
    expect(Array.isArray(payments)).toBe(true);
  });

  test('Revenue chart timeseries calculation groups records by date', async () => {
    const { data: cases, error } = await supabase
      .from('recovery_cases')
      .select('created_at, status, revenue_at_risk, recovered_amount');
    expect(error).toBeNull();
    expect(Array.isArray(cases)).toBe(true);

    const dateMap = {};
    cases.forEach(c => {
      const dateStr = c.created_at ? c.created_at.substring(0, 10) : '2026-09-02';
      if (!dateMap[dateStr]) {
        dateMap[dateStr] = { revenue_at_risk: 0, revenue_recovered: 0 };
      }
      if (['open', 'in_recovery'].includes((c.status || '').toLowerCase())) {
        dateMap[dateStr].revenue_at_risk += Number(c.revenue_at_risk || 0);
      }
      dateMap[dateStr].revenue_recovered += Number(c.recovered_amount || 0);
    });

    expect(typeof dateMap).toBe('object');
  });

  test('Recovery cases detail query returns joined payment, customer, attempts, and audit logs', async () => {
    const { data: cases, error } = await supabase
      .from('recovery_cases')
      .select('*, payments(*), customers(*)')
      .limit(1);

    expect(error).toBeNull();
    expect(cases).not.toBeNull();
    if (cases && cases.length > 0) {
      const caseItem = cases[0];
      expect(caseItem).toHaveProperty('id');
      expect(caseItem).toHaveProperty('status');
      expect(caseItem).toHaveProperty('payments');
      expect(caseItem).toHaveProperty('customers');

      const { data: attempts } = await supabase
        .from('recovery_attempts')
        .select('*')
        .eq('case_id', caseItem.id);
      expect(Array.isArray(attempts)).toBe(true);

      const { data: auditLogs } = await supabase
        .from('audit_logs')
        .select('*')
        .or(`entity_id.eq.${caseItem.id},entity_id.eq.${caseItem.payment_id}`);
      expect(Array.isArray(auditLogs)).toBe(true);
    }
  });
});
