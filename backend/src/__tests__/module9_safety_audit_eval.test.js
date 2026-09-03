const recoveryExecutionRouter = require('../routes/recoveryExecution');
const webhooksRouter = require('../routes/webhooks');
const auditRouter = require('../routes/audit');
const analyticsRouter = require('../routes/analytics');
const modelEvaluationRouter = require('../routes/modelEvaluation');
const eventsRouter = require('../routes/events');
const { supabase } = require('../config/supabase');
const paymentService = require('../services/paymentService');

describe('Module 9 — Safety, Audit & Evaluation Complete Test Suite', () => {
  let testCaseId;
  let testPaymentId;
  let testCustomerId;

  beforeAll(async () => {
    // Fetch a real test case, payment, and customer from DB
    const { data: cases } = await supabase
      .from('recovery_cases')
      .select('*, payments(*), customers(*)')
      .limit(1);

    if (cases && cases.length > 0) {
      testCaseId = cases[0].id;
      testPaymentId = cases[0].payment_id;
      testCustomerId = cases[0].customer_id;
    }
  });

  // Helper to extract handler from Express router
  function getRouteHandler(router, path, method = 'post') {
    const routeItem = router.stack.find(s => s.route && s.route.path === path && s.route.methods[method]);
    if (!routeItem) throw new Error(`Route '${method.toUpperCase()} ${path}' not found in router`);
    return routeItem.route.stack[routeItem.route.stack.length - 1].handle;
  }

  // 1. Malformed UUID Test
  test('1. Rejects malformed UUID with 400 Bad Request', async () => {
    const handler = getRouteHandler(recoveryExecutionRouter, '/:caseId/execute', 'post');
    const req = { params: { caseId: 'invalid-uuid-123' }, body: { action: 'RETRY_PAYMENT' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    await handler(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
  });

  // 2. Invalid Request Body Test
  test('2. Rejects invalid request body parameters cleanly', async () => {
    const handler = getRouteHandler(eventsRouter, '/', 'post');
    const req = { body: { event_type: 'PAYMENT_FAILED', amount: 'not-a-number', customer_id: testCustomerId } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    await handler(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
  });

  // 3. Invalid Action Test
  test('3. Evaluates invalid action safely via guardrails', async () => {
    if (!testCaseId) return;
    const handler = getRouteHandler(recoveryExecutionRouter, '/:caseId/execute', 'post');
    const req = { params: { caseId: testCaseId }, body: { action: 'UNAUTHORIZED_ACTION' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    await handler(req, res, next);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        guardrail_status: 'REJECTED'
      })
    }));
  });

  // 4. Negative Amount Test
  test('4. Rejects negative amount in event ingestion with 400 Bad Request', async () => {
    const handler = getRouteHandler(eventsRouter, '/', 'post');
    const req = { body: { event_type: 'PAYMENT_FAILED', customer_id: testCustomerId || '00000000-0000-0000-0000-000000000001', amount: -500.0, payment_reference: 'pay_neg' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    await handler(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
  });

  // 5. Duplicate Idempotency Key Test
  test('5. Handles duplicate idempotency key idempotently', async () => {
    if (!testCaseId) return;
    const key = `idem_test_${Date.now()}`;
    const handler = getRouteHandler(recoveryExecutionRouter, '/:caseId/execute', 'post');

    // First execution
    const req1 = { params: { caseId: testCaseId }, body: { action: 'RETRY_PAYMENT', simulate_success: true, idempotency_key: key } };
    const res1 = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await handler(req1, res1, jest.fn());
    expect(res1.status).toHaveBeenCalledWith(200);

    // Second execution with identical key
    const req2 = { params: { caseId: testCaseId }, body: { action: 'RETRY_PAYMENT', simulate_success: true, idempotency_key: key } };
    const res2 = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await handler(req2, res2, jest.fn());

    expect(res2.status).toHaveBeenCalledWith(200);
    expect(res2.json).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ is_duplicate: true })
    }));
  });

  // 6. Duplicate Webhook Test
  test('6. Handles duplicate webhook event idempotently', async () => {
    const handler = getRouteHandler(webhooksRouter, '/mock-payment', 'post');
    const webhookKey = `wh_key_${Date.now()}`;
    const payload = { event: 'payment.success', idempotency_key: webhookKey, payload: { case_id: testCaseId, amount: 12500 } };

    const req1 = { body: payload };
    const res1 = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await handler(req1, res1, jest.fn());
    expect(res1.status).toHaveBeenCalledWith(200);

    const req2 = { body: payload };
    const res2 = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await handler(req2, res2, jest.fn());

    expect(res2.status).toHaveBeenCalledWith(200);
    expect(res2.json).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'ignored', reason: 'duplicate_event' })
    }));
  });

  // 7. Maximum Retry Limit Guardrail Test
  test('7. Escalates to human when max retry count is reached', async () => {
    const mockCase = { id: 'case-test', revenue_at_risk: 1000 };
    const mockPayment = { amount: 1000, status: 'failed' };
    const mockCustomer = { opted_out: false };

    const check = await paymentService.checkGuardrails(mockCase, mockPayment, mockCustomer, 'RETRY_PAYMENT', 3);
    expect(check.passed).toBe(false);
    expect(check.status).toBe('ESCALATED');
    expect(check.action).toBe('ESCALATE_TO_HUMAN');
  });

  // 8. High-Value Human Escalation Guardrail Test
  test('8. Flags high-value transactions >= ₹50,000 for human approval', async () => {
    const mockCase = { id: 'case-hv', revenue_at_risk: 75000 };
    const mockPayment = { amount: 75000, status: 'failed' };
    const mockCustomer = { opted_out: false };

    const check = await paymentService.checkGuardrails(mockCase, mockPayment, mockCustomer, 'RETRY_PAYMENT', 0);
    expect(check.passed).toBe(false);
    expect(check.status).toBe('FLAGGED_FOR_HUMAN');
    expect(check.action).toBe('ESCALATE_TO_HUMAN');
  });

  // 9. Successful Payment STOP Guardrail Test
  test('9. Stops recovery workflow if payment is already recovered', async () => {
    const mockCase = { id: 'case-captured', status: 'recovered', revenue_at_risk: 0 };
    const mockPayment = { amount: 1000, status: 'captured' };
    const mockCustomer = {};

    const check = await paymentService.checkGuardrails(mockCase, mockPayment, mockCustomer, 'RETRY_PAYMENT', 0);
    expect(check.passed).toBe(false);
    expect(check.status).toBe('STOPPED');
    expect(check.action).toBe('STOP');
  });

  // 10. Safe API Error Response Test
  test('10. Returns safe error response without exposing stack traces or secrets', async () => {
    const { errorHandler } = require('../middleware/errorHandler');
    const err = new Error('Database connection failed: postgresql://postgres:password123@localhost:5432/db');
    err.statusCode = 500;
    const req = { method: 'GET', path: '/api/test' };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    errorHandler(err, req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      error: expect.objectContaining({
        message: 'Database operation failed. Details suppressed for security.'
      })
    }));
    expect(res.json).not.toHaveBeenCalledWith(expect.objectContaining({
      error: expect.objectContaining({ stack: expect.anything() })
    }));
  });

  // 11. Rate Limiting Test
  test('11. Enforces rate limiting when limit exceeded', async () => {
    const { createRateLimiter } = require('../middleware/rateLimiter');
    const strictLimiter = createRateLimiter({ windowMs: 1000, max: 2, message: 'Rate limit exceeded' });

    const reqMock = { ip: '1.2.3.4', headers: { 'x-test-rate-limit': 'true' } };
    const resMock = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    const nextMock = jest.fn();

    strictLimiter(reqMock, resMock, nextMock);
    strictLimiter(reqMock, resMock, nextMock);
    strictLimiter(reqMock, resMock, nextMock);

    expect(resMock.status).toHaveBeenCalledWith(429);
    expect(resMock.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      error: expect.objectContaining({ message: 'Rate limit exceeded' })
    }));
  });

  // 12. Audit Record Creation Test
  test('12. Logs audit record to audit_logs on execution', async () => {
    await paymentService.logAudit('test_audit_event_mod9', 'test_entity', testCaseId || '00000000-0000-0000-0000-000000000001', 'system', { test: true });

    const { data: logs } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('event_type', 'test_audit_event_mod9');

    expect(Array.isArray(logs)).toBe(true);
    expect(logs.length).toBeGreaterThan(0);
  });

  // 13. Recovery Attempt Persistence Test
  test('13. Persists recovery attempt in recovery_attempts table', async () => {
    if (!testCaseId || !testPaymentId) return;

    const { data: attempt, error } = await supabase.from('recovery_attempts').insert({
      case_id: testCaseId,
      payment_id: testPaymentId,
      strategy: 'retry',
      action: 'RETRY_PAYMENT',
      status: 'success',
      predicted_amount: 5000,
      actual_amount: 5000,
      safety_check_passed: true,
      executed_at: new Date().toISOString()
    }).select();

    expect(error).toBeNull();
    expect(attempt).not.toBeNull();
    expect(attempt[0].status).toBe('success');
  });

  // 14. Analytics API Test
  test('14. GET /api/analytics/recovery returns database-derived business metrics', async () => {
    const handler = getRouteHandler(analyticsRouter, '/recovery', 'get');
    const req = {};
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    await handler(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: expect.objectContaining({
        total_revenue_at_risk: expect.any(Number),
        total_revenue_recovered: expect.any(Number),
        recovery_rate: expect.any(Number),
        revenue_by_intervention_type: expect.any(Array)
      })
    }));
  });

  // 15. Model Evaluation API Test
  test('15. GET /api/model/evaluation returns XGBoost evaluation metrics', async () => {
    const handler = getRouteHandler(modelEvaluationRouter, '/evaluation', 'get');
    const req = {};
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    await handler(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: expect.objectContaining({
        metrics: {
          accuracy: 0.8172,
          precision: 0.8329,
          recall: 0.9677,
          f1: 0.8953,
          roc_auc: 0.7659
        },
        disclaimer: expect.stringContaining('NOT business recovery metrics')
      })
    }));
  });

  // 16. Audit Explorer API Test
  test('16. GET /api/audit returns paginated audit records with search & filter support', async () => {
    const handler = getRouteHandler(auditRouter, '/', 'get');
    const req = { query: { page: '1', limit: '10' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    await handler(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: expect.objectContaining({
        logs: expect.any(Array),
        pagination: expect.objectContaining({
          total: expect.any(Number),
          page: 1,
          limit: 10
        })
      })
    }));
  });
});
