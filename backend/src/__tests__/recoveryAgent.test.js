const { runRecoveryAgent } = require('../services/aiService');
const recoveryAgentRouter = require('../routes/recoveryAgent');

describe('Module 6: Backend Recovery Agent Integration', () => {
  const samplePayload = {
    recovery_case_id: '44444444-4444-4444-4444-444444444402',
    is_demo: true,
    demo_simulate_success: true
  };

  test('Backend handles successful run-recovery-agent from AI service', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          recovery_case_id: '44444444-4444-4444-4444-444444444402',
          recovery_probability: 0.85,
          risk_level: 'LOW',
          model_version: 'recovery-xgboost-v1.0',
          shap_explanation: { human_explanation: 'Strong payment history.' },
          root_cause: 'Temporary card decline with high recovery likelihood.',
          recommended_action: 'RETRY_PAYMENT',
          guardrail_decision: { status: 'APPROVED', reason: 'Safety checks passed' },
          execution_result: { status: 'SUCCESS', simulated: true },
          recovered_amount: 12500,
          final_status: 'recovered',
          audit_logs: [
            { current_state: 'RECEIVE_CASE' },
            { current_state: 'ANALYZE_CASE' },
            { current_state: 'GET_ML_PREDICTION' },
            { current_state: 'GET_SHAP_EXPLANATION' },
            { current_state: 'DIAGNOSE_ROOT_CAUSE' },
            { current_state: 'SELECT_INTERVENTION' },
            { current_state: 'APPLY_GUARDRAILS' },
            { current_state: 'EXECUTE_ACTION' },
            { current_state: 'VERIFY_RESULT' },
            { current_state: 'UPDATE_CASE' },
            { current_state: 'AUDIT' }
          ]
        }
      })
    });

    const result = await runRecoveryAgent(samplePayload);

    expect(result).toBeDefined();
    expect(result.data.recovery_case_id).toBe('44444444-4444-4444-4444-444444444402');
    expect(result.data.recommended_action).toBe('RETRY_PAYMENT');
    expect(result.data.guardrail_decision.status).toBe('APPROVED');
    expect(result.data.recovered_amount).toBe(12500);
    expect(result.data.final_status).toBe('recovered');

    global.fetch = originalFetch;
  });

  test('POST /api/recovery-agent/run route handles request and returns structured agent output', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          recovery_case_id: '44444444-4444-4444-4444-444444444402',
          recovery_probability: 0.85,
          risk_level: 'LOW',
          recommended_action: 'RETRY_PAYMENT',
          final_status: 'recovered'
        }
      })
    });

    const req = { body: samplePayload };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    const next = jest.fn();

    const routeHandler = recoveryAgentRouter.stack.find(s => s.route && s.route.path === '/run').route.stack[0].handle;
    await routeHandler(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({ recommended_action: 'RETRY_PAYMENT' })
      })
    );

    global.fetch = originalFetch;
  });

  test('POST /api/recovery-agent/run returns 400 when missing case payload', async () => {
    const req = { body: {} };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    const next = jest.fn();

    const routeHandler = recoveryAgentRouter.stack.find(s => s.route && s.route.path === '/run').route.stack[0].handle;
    await routeHandler(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'INVALID_PAYLOAD' })
      })
    );
  });
});
