const { predictRecovery } = require('../services/aiService');

describe('Module 4: Backend AI Service Integration', () => {
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

  test('16. Backend handles successful prediction response from AI service', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        recovery_probability: 0.78,
        risk_level: 'LOW',
        model_version: 'recovery-xgboost-v1.0'
      })
    });

    const result = await predictRecovery(samplePayload);

    expect(result).toBeDefined();
    expect(result.recovery_probability).toBe(0.78);
    expect(result.risk_level).toBe('LOW');
    expect(result.model_version).toBe('recovery-xgboost-v1.0');

    global.fetch = originalFetch;
  });

  test('17. Backend handles AI service error responses safely', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ detail: 'Unprocessable Entity - missing feature' })
    });

    await expect(predictRecovery(samplePayload)).rejects.toThrow();

    global.fetch = originalFetch;
  });

  test('17b. Backend handles AI service connection network failures safely', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(predictRecovery(samplePayload)).rejects.toThrow(/Failed to connect to AI service/);

    global.fetch = originalFetch;
  });
});
