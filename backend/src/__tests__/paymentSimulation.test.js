/**
 * RazorRecover — Module 7 Payment Simulation & Execution Test Suite (Jest)
 */

const { MockPaymentProvider, RazorpayProvider } = require('../services/paymentProvider');
const paymentService = require('../services/paymentService');
const recoveryExecutionRouter = require('../routes/recoveryExecution');
const webhooksRouter = require('../routes/webhooks');
const { supabase } = require('../config/supabase');

describe('Module 7 — Payment Simulation & Execution Layer', () => {

  const TEST_CASE_ID = '44444444-4444-4444-4444-444444444402';

  // Helper to reset test case state for clean testing
  async function resetTestCaseState() {
    try {
      await supabase.from('recovery_attempts').delete().eq('case_id', TEST_CASE_ID);
      
      const { data: cases } = await supabase.from('recovery_cases').select('payment_id').eq('id', TEST_CASE_ID);
      if (cases && cases.length > 0 && cases[0].payment_id) {
        await supabase.from('payments').update({ status: 'failed' }).eq('id', cases[0].payment_id);
      }

      await supabase
        .from('recovery_cases')
        .update({
          status: 'in_recovery',
          recovered_amount: 0.0,
          revenue_at_risk: 12500.0,
          strategy: 'retry',
          escalated_to_human: false
        })
        .eq('id', TEST_CASE_ID);
    } catch (e) {
      // ignore in offline environment
    }
  }

  beforeEach(async () => {
    await resetTestCaseState();
  });

  // ---------------- 1. Provider Abstraction Tests ----------------

  describe('1. Payment Provider Abstraction & Razorpay Safety', () => {
    test('MockPaymentProvider returns deterministic transaction reference (MOCK_PAY_XXXXXXXX)', async () => {
      const provider = new MockPaymentProvider();
      const res = await provider.retryPayment('pmt_123', 'case_123', 12500, 'insufficient_funds', { simulate_success: true });
      
      expect(res.transaction_reference).toMatch(/^MOCK_PAY_[A-Z0-9]{8}$/);
      expect(res.status).toBe('SUCCESS');
      expect(res.provider).toBe('mock');
      expect(res.is_demo).toBe(true);
      expect(res.mode).toBe('SIMULATION');
    });

    test('MockPaymentProvider supports SUCCESS, FAILED, PENDING, CANCELLED', async () => {
      const provider = new MockPaymentProvider();
      const statuses = ['SUCCESS', 'FAILED', 'PENDING', 'CANCELLED'];

      for (const st of statuses) {
        const res = await provider.retryPayment('pmt_123', 'case_123', 1000, 'none', { simulate_status: st });
        expect(res.status).toBe(st);
      }
    });

    test('RazorpayProvider throws error without credentials and remains inactive', async () => {
      const razorpay = new RazorpayProvider();
      await expect(razorpay.retryPayment()).rejects.toThrow(/RazorpayProvider is unconfigured and inactive/);
    });
  });

  // ---------------- 2. Deterministic ₹12,500 Demo & Execution API ----------------

  describe('2. Recovery Execution APIs (/api/recovery)', () => {
    test('POST /api/recovery/:caseId/retry route handler executes payment retry and recovers ₹12,500 on success', async () => {
      const idempotencyKey = `test_idem_${Date.now()}`;
      
      const req = {
        params: { caseId: TEST_CASE_ID },
        body: { simulate_success: true, idempotency_key: idempotencyKey }
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      const routeHandler = recoveryExecutionRouter.stack.find(s => s.route && s.route.path === '/:caseId/retry').route.stack[0].handle;
      await routeHandler(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            status: 'RECOVERED',
            recovered_amount: 12500
          })
        })
      );
    });

    test('GET /api/recovery/:caseId/status route handler returns status and audit logs', async () => {
      const req = { params: { caseId: TEST_CASE_ID } };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      const routeHandler = recoveryExecutionRouter.stack.find(s => s.route && s.route.path === '/:caseId/status').route.stack[0].handle;
      await routeHandler(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            recovery_case: expect.anything(),
            attempts: expect.anything()
          })
        })
      );
    });
  });

  // ---------------- 3. Mock Webhooks & Idempotency ----------------

  describe('3. Mock Webhook Processing (/api/webhooks/mock-payment)', () => {
    test('POST /api/webhooks/mock-payment processes payment.success and updates recovery case', async () => {
      const eventId = `wh_evt_${Date.now()}`;
      const req = {
        body: {
          event: 'payment.success',
          event_id: eventId,
          payload: {
            case_id: TEST_CASE_ID,
            amount: 12500,
            transaction_reference: 'MOCK_PAY_WEBHOOK_123'
          }
        }
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      const routeHandler = webhooksRouter.stack.find(s => s.route && s.route.path === '/mock-payment').route.stack[0].handle;
      await routeHandler(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            status: 'processed',
            recovered_amount: 12500
          })
        })
      );
    });

    test('Duplicate webhook event is ignored idempotently', async () => {
      const eventId = `wh_dup_${Date.now()}`;
      
      const req1 = {
        body: {
          event: 'payment.success',
          event_id: eventId,
          payload: { case_id: TEST_CASE_ID, amount: 12500 }
        }
      };
      const res1 = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next1 = jest.fn();

      const routeHandler = webhooksRouter.stack.find(s => s.route && s.route.path === '/mock-payment').route.stack[0].handle;
      await routeHandler(req1, res1, next1);

      const req2 = {
        body: {
          event: 'payment.success',
          event_id: eventId,
          payload: { case_id: TEST_CASE_ID, amount: 12500 }
        }
      };
      const res2 = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next2 = jest.fn();

      await routeHandler(req2, res2, next2);

      expect(res2.status).toHaveBeenCalledWith(200);
      expect(res2.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            status: 'ignored',
            reason: 'duplicate_event'
          })
        })
      );
    });
  });

  // ---------------- 4. Scenarios A through F Verification ----------------

  describe('4. Failure Testing Scenarios A through F', () => {
    
    // Scenario A: FAILED -> RETRY -> SUCCESS
    test('Scenario A: FAILED -> RETRY -> SUCCESS recovers ₹12,500 and persists recovery_attempts row', async () => {
      const idemKey = `scenario_a_${Date.now()}`;
      const res = await paymentService.executeRecoveryAction(TEST_CASE_ID, {
        action: 'RETRY_PAYMENT',
        simulate_success: true,
        idempotency_key: idemKey
      });

      expect(res.success).toBe(true);
      expect(res.status).toBe('RECOVERED');
      expect(res.recovered_amount).toBe(12500);

      // Verify row persisted in recovery_attempts table
      const { data: dbAttempts } = await supabase
        .from('recovery_attempts')
        .select('*')
        .eq('case_id', TEST_CASE_ID)
        .eq('status', 'success');

      expect(dbAttempts).toBeDefined();
      expect(dbAttempts.length).toBeGreaterThan(0);
      expect(dbAttempts[0].provider).toBe('mock');
      expect(dbAttempts[0].transaction_reference).toMatch(/^MOCK_PAY_/);
    });

    // Scenario B: FAILED -> RETRY -> FAILED
    test('Scenario B: FAILED -> RETRY -> FAILED leaves recovered amount at 0 and persists failed recovery_attempts row', async () => {
      const idemKey = `scenario_b_${Date.now()}`;
      const res = await paymentService.executeRecoveryAction(TEST_CASE_ID, {
        action: 'RETRY_PAYMENT',
        simulate_success: false,
        idempotency_key: idemKey
      });

      expect(res.success).toBe(false);
      expect(res.recovered_amount).toBe(0.0);
      expect(res.execution_result).toBeDefined();

      // Verify row persisted in recovery_attempts table for failed attempt
      const { data: dbAttempts } = await supabase
        .from('recovery_attempts')
        .select('*')
        .eq('case_id', TEST_CASE_ID)
        .eq('status', 'failed');

      expect(dbAttempts).toBeDefined();
      expect(dbAttempts.length).toBeGreaterThan(0);
      expect(dbAttempts[0].provider).toBe('mock');
    });

    // Scenario C: 3 Failed Retries -> ESCALATE_TO_HUMAN
    test('Scenario C: 3 failed retries triggers ESCALATE_TO_HUMAN and blocks 4th retry', async () => {
      const guardrail = await paymentService.checkGuardrails(
        { status: 'in_recovery', revenue_at_risk: 1000 },
        { amount: 1000, status: 'failed' },
        { opted_out: false },
        'RETRY_PAYMENT',
        3 // 3 retries done
      );

      expect(guardrail.passed).toBe(false);
      expect(guardrail.status).toBe('ESCALATED');
      expect(guardrail.action).toBe('ESCALATE_TO_HUMAN');
    });

    // Scenario D: Already Successful Payment -> STOP
    test('Scenario D: Already successful payment returns STOP', async () => {
      const guardrail = await paymentService.checkGuardrails(
        { status: 'recovered', revenue_at_risk: 0 },
        { amount: 1000, status: 'captured' },
        { opted_out: false },
        'RETRY_PAYMENT',
        0
      );

      expect(guardrail.passed).toBe(false);
      expect(guardrail.status).toBe('STOPPED');
      expect(guardrail.action).toBe('STOP');
    });

    // Scenario E: Duplicate Webhook Event Ignored
    test('Scenario E: Duplicate webhook does not duplicate attempts or revenue', async () => {
      const duplicateKey = `idem_webhook_test_${Date.now()}`;
      
      const res1 = await paymentService.processWebhookEvent({
        event: 'payment.success',
        idempotency_key: duplicateKey,
        payload: { case_id: TEST_CASE_ID, amount: 5000 }
      });

      const res2 = await paymentService.processWebhookEvent({
        event: 'payment.success',
        idempotency_key: duplicateKey,
        payload: { case_id: TEST_CASE_ID, amount: 5000 }
      });

      expect(res1.status).toBe('processed');
      expect(res2.status).toBe('ignored');
      expect(res2.reason).toBe('duplicate_event');
    });

    // Scenario F: High-Value Transaction -> HUMAN APPROVAL REQUIRED
    test('Scenario F: High-value transaction (>= ₹50,000) requires HUMAN APPROVAL', async () => {
      const guardrail = await paymentService.checkGuardrails(
        { status: 'in_recovery', revenue_at_risk: 75000 },
        { amount: 75000, status: 'failed' },
        { opted_out: false },
        'RETRY_PAYMENT',
        0
      );

      expect(guardrail.passed).toBe(false);
      expect(guardrail.status).toBe('FLAGGED_FOR_HUMAN');
      expect(guardrail.action).toBe('ESCALATE_TO_HUMAN');
    });

  });

});
