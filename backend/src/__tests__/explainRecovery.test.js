const { explainRecovery } = require('../services/aiService');
const explainRecoveryRouter = require('../routes/explainRecovery');

describe('Module 5: Backend SHAP Explainability Integration', () => {
  const samplePayload = {
    transaction_amount: 12500,
    customer_payment_history: 12,
    previous_success_rate: 0.83,
    previous_failure_count: 2,
    failure_type: 'insufficient_funds',
    retry_count: 1,
    customer_age_days: 420,
    subscription_status: 'active',
    time_since_failure: 2,
    payment_method: 'upi',
    customer_segment: 'regular',
    invoice_age: 0,
    previous_recovery_success: 1
  };

  test('17. Backend handles successful explanation response from AI service', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        recovery_probability: 0.9662,
        risk_level: 'LOW',
        model_version: 'recovery-xgboost-v1.0',
        top_positive_factors: [
          {
            feature: 'Subscription status',
            importance: 'HIGH',
            explanation: 'Active subscription status (active)'
          }
        ],
        top_negative_factors: [
          {
            feature: 'Previous failure count',
            importance: 'LOW',
            explanation: 'Several previous payment failures (2)'
          }
        ],
        feature_importance: [
          { feature: 'Subscription status', importance: 'HIGH', impact: 'positive' }
        ],
        human_explanation: 'Active subscription status (active).'
      })
    });

    const result = await explainRecovery(samplePayload);

    expect(result).toBeDefined();
    expect(result.recovery_probability).toBe(0.9662);
    expect(result.risk_level).toBe('LOW');
    expect(result.top_positive_factors).toHaveLength(1);
    expect(result.human_explanation).toContain('Active subscription status');

    global.fetch = originalFetch;
  });

  test('18. POST /api/explain-recovery route handles request and formats response', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        recovery_probability: 0.9662,
        risk_level: 'LOW',
        model_version: 'recovery-xgboost-v1.0',
        top_positive_factors: [],
        top_negative_factors: [],
        feature_importance: [],
        human_explanation: 'Sample explanation text.'
      })
    });

    const req = { body: samplePayload };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    const next = jest.fn();

    // Invoke router stack directly
    const routeHandler = explainRecoveryRouter.stack.find(s => s.route && s.route.path === '/').route.stack[0].handle;
    await routeHandler(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({ recovery_probability: 0.9662 })
      })
    );

    global.fetch = originalFetch;
  });

  test('19. Backend handles AI service connection failure honestly without fake data', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(explainRecovery(samplePayload)).rejects.toThrow(/Failed to connect to AI service/);

    global.fetch = originalFetch;
  });
});
