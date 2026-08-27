const express = require('express');
const { supabase } = require('../config/supabase');
const eventRoutes = require('../routes/events');
const demoRoutes = require('../routes/demo');
const { errorHandler } = require('../middleware/errorHandler');
const { calculateRevenueAtRisk, isUuid } = require('../services/eventEngine');

// Setup a clean Express app for API routing integration tests
const app = express();
app.use(express.json());
app.use('/api/events', eventRoutes);
app.use('/api/demo', demoRoutes);
app.use(errorHandler);

let server;
const PORT = 5999;
const BASE_URL = `http://localhost:${PORT}`;

// We will use the seeded customer in the tests
const TEST_CUSTOMER_ID = '00000000-0000-0000-0000-000000000001'; // Alice Johnson

// Generate random unique references to isolate test runs
function makeRef() {
  return `ref_test_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}

jest.setTimeout(30000);

beforeAll((done) => {
  server = app.listen(PORT, () => {
    done();
  });
});

afterAll((done) => {
  server.close(() => {
    done();
  });
});

describe('Module 3 - Revenue Event Engine', () => {

  // Test 10: Revenue-at-risk calculation logic
  describe('Revenue-at-Risk Calculation', () => {
    it('calculates risk for PAYMENT_FAILED correctly', () => {
      expect(calculateRevenueAtRisk('PAYMENT_FAILED', 12500)).toBe(12500);
      expect(calculateRevenueAtRisk('PAYMENT_FAILED', '1500.50')).toBe(1500.50);
    });

    it('calculates risk for CHECKOUT_ABANDONED correctly', () => {
      expect(calculateRevenueAtRisk('CHECKOUT_ABANDONED', 3000)).toBe(3000);
    });

    it('calculates risk for SUBSCRIPTION_FAILED correctly', () => {
      expect(calculateRevenueAtRisk('SUBSCRIPTION_FAILED', 4500)).toBe(4500);
    });

    it('calculates risk for INVOICE_OVERDUE correctly', () => {
      expect(calculateRevenueAtRisk('INVOICE_OVERDUE', 999.99)).toBe(999.99);
    });

    it('calculates risk for PAYMENT_SUCCESS as 0', () => {
      expect(calculateRevenueAtRisk('PAYMENT_SUCCESS', 12500)).toBe(0.00);
    });

    it('returns 0 for negative or invalid amounts', () => {
      expect(calculateRevenueAtRisk('PAYMENT_FAILED', -100)).toBe(0.00);
      expect(calculateRevenueAtRisk('PAYMENT_FAILED', 'invalid')).toBe(0.00);
    });
  });

  // API Route and Flow Tests
  describe('API Event Ingestion & Processing Flow', () => {
    
    // Test 1: Valid PAYMENT_FAILED event
    // Test 11: Recovery case creation
    // Test 13: Audit log creation
    it('successfully processes a valid PAYMENT_FAILED event, creating payment, case, and audit log', async () => {
      const reference = makeRef();
      const payload = {
        event_type: 'PAYMENT_FAILED',
        customer_id: TEST_CUSTOMER_ID,
        payment_reference: reference,
        amount: 12500,
        timestamp: new Date().toISOString(),
        metadata: { gateway: 'razorpay' }
      };

      const response = await fetch(`${BASE_URL}/api/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      expect(response.status).toBe(200);
      const json = await response.json();
      
      expect(json.success).toBe(true);
      expect(isUuid(json.data.event_id)).toBe(true);
      expect(json.data.event_type).toBe('PAYMENT_FAILED');
      expect(json.data.revenue_at_risk).toBe(12500);
      expect(isUuid(json.data.recovery_case_id)).toBe(true);
      expect(json.data.status).toBe('processed');

      // Verify DB Storage
      // 1. Verify Event is stored
      const { data: storedEvents } = await supabase
        .from('revenue_events')
        .select('*')
        .eq('id', json.data.event_id);
      expect(storedEvents.length).toBe(1);
      expect(storedEvents[0].payment_reference).toBe(reference);

      // 2. Verify Payment is stored
      const { data: payments } = await supabase
        .from('payments')
        .select('*')
        .eq('razorpay_payment_id', reference);
      expect(payments.length).toBe(1);
      expect(parseFloat(payments[0].amount)).toBe(12500);
      expect(payments[0].status).toBe('failed');

      // 3. Verify Recovery Case is created
      const { data: cases } = await supabase
        .from('recovery_cases')
        .select('*')
        .eq('id', json.data.recovery_case_id);
      expect(cases.length).toBe(1);
      expect(cases[0].status).toBe('open');
      expect(parseFloat(cases[0].revenue_at_risk)).toBe(12500);

      // 4. Verify Audit Log exists
      const { data: audits } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('entity_id', json.data.recovery_case_id);
      expect(audits.length).toBeGreaterThanOrEqual(1);
      expect(audits[0].event_type).toBe('payment_failed');
    });

    // Test 2: Invalid event_type
    it('rejects unsupported event_types', async () => {
      const payload = {
        event_type: 'INVALID_EVENT_TYPE',
        customer_id: TEST_CUSTOMER_ID,
        payment_reference: makeRef(),
        amount: 500,
        timestamp: new Date().toISOString(),
        metadata: {}
      };

      const response = await fetch(`${BASE_URL}/api/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.success).toBe(false);
      expect(json.error.message).toContain('Unsupported event type');
    });

    // Test 3: Invalid customer_id format or non-existent
    it('rejects invalid customer_id UUID formats', async () => {
      const payload = {
        event_type: 'PAYMENT_FAILED',
        customer_id: 'not-a-uuid',
        payment_reference: makeRef(),
        amount: 500,
        timestamp: new Date().toISOString(),
        metadata: {}
      };

      const response = await fetch(`${BASE_URL}/api/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.success).toBe(false);
      expect(json.error.message).toContain('Invalid customer_id format');
    });

    it('rejects valid UUID customer_ids that do not exist in database', async () => {
      const payload = {
        event_type: 'PAYMENT_FAILED',
        customer_id: '99999999-9999-9999-9999-999999999999',
        payment_reference: makeRef(),
        amount: 500,
        timestamp: new Date().toISOString(),
        metadata: {}
      };

      const response = await fetch(`${BASE_URL}/api/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.success).toBe(false);
      expect(json.error.message).toContain('does not exist');
    });

    // Test 4: Invalid amount
    it('rejects negative amount', async () => {
      const payload = {
        event_type: 'PAYMENT_FAILED',
        customer_id: TEST_CUSTOMER_ID,
        payment_reference: makeRef(),
        amount: -500,
        timestamp: new Date().toISOString(),
        metadata: {}
      };

      const response = await fetch(`${BASE_URL}/api/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.success).toBe(false);
      expect(json.error.message).toContain('Invalid amount');
    });

    // Test 5: Missing required fields
    it('rejects payloads missing required fields', async () => {
      const payload = {
        event_type: 'PAYMENT_FAILED',
        customer_id: TEST_CUSTOMER_ID,
        // missing payment_reference
        amount: 500,
        timestamp: new Date().toISOString(),
        metadata: {}
      };

      const response = await fetch(`${BASE_URL}/api/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.success).toBe(false);
      expect(json.error.message).toContain('payment_reference');
    });

    // Test 6: PAYMENT_SUCCESS event (resolves matching case)
    // Test 12: Recovery case update behavior
    it('successfully processes PAYMENT_SUCCESS, updating the specific matching case only', async () => {
      const referenceToResolve = makeRef();
      const referenceToKeep = makeRef();

      // 1. Create two open recovery cases for same customer
      const failEvent1 = {
        event_type: 'PAYMENT_FAILED',
        customer_id: TEST_CUSTOMER_ID,
        payment_reference: referenceToResolve,
        amount: 1500,
        timestamp: new Date().toISOString(),
        metadata: {}
      };
      const failEvent2 = {
        event_type: 'PAYMENT_FAILED',
        customer_id: TEST_CUSTOMER_ID,
        payment_reference: referenceToKeep,
        amount: 2500,
        timestamp: new Date().toISOString(),
        metadata: {}
      };

      const resFail1 = await fetch(`${BASE_URL}/api/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(failEvent1)
      });
      const resFail2 = await fetch(`${BASE_URL}/api/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(failEvent2)
      });

      const jsonFail1 = await resFail1.json();
      const jsonFail2 = await resFail2.json();
      const caseIdToResolve = jsonFail1.data.recovery_case_id;
      const caseIdToKeep = jsonFail2.data.recovery_case_id;

      // Verify both cases are open
      const { data: initialCases } = await supabase
        .from('recovery_cases')
        .select('*')
        .in('id', [caseIdToResolve, caseIdToKeep]);
      expect(initialCases.find(c => c.id === caseIdToResolve).status).toBe('open');
      expect(initialCases.find(c => c.id === caseIdToKeep).status).toBe('open');

      // 2. Ingest PAYMENT_SUCCESS for the first reference
      const successEvent = {
        event_type: 'PAYMENT_SUCCESS',
        customer_id: TEST_CUSTOMER_ID,
        payment_reference: referenceToResolve,
        amount: 1500,
        timestamp: new Date().toISOString(),
        metadata: {}
      };

      const resSuccess = await fetch(`${BASE_URL}/api/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(successEvent)
      });
      expect(resSuccess.status).toBe(200);

      // 3. Verify only the matching case is resolved (recovered)
      const { data: finalCases } = await supabase
        .from('recovery_cases')
        .select('*')
        .in('id', [caseIdToResolve, caseIdToKeep]);

      const resolvedCase = finalCases.find(c => c.id === caseIdToResolve);
      const unchangedCase = finalCases.find(c => c.id === caseIdToKeep);

      expect(resolvedCase.status).toBe('recovered');
      expect(parseFloat(resolvedCase.revenue_at_risk)).toBe(0.00);
      expect(parseFloat(resolvedCase.recovered_amount)).toBe(1500.00);

      expect(unchangedCase.status).toBe('open');
      expect(parseFloat(unchangedCase.revenue_at_risk)).toBe(2500.00);
      expect(parseFloat(unchangedCase.recovered_amount)).toBe(0.00);
    }, 30000);

    // Test 7: CHECKOUT_ABANDONED event
    it('successfully processes CHECKOUT_ABANDONED event', async () => {
      const reference = makeRef();
      const payload = {
        event_type: 'CHECKOUT_ABANDONED',
        customer_id: TEST_CUSTOMER_ID,
        payment_reference: reference,
        amount: 5000,
        timestamp: new Date().toISOString(),
        metadata: {}
      };

      const response = await fetch(`${BASE_URL}/api/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.data.revenue_at_risk).toBe(5000);
      expect(json.data.event_type).toBe('CHECKOUT_ABANDONED');
    });

    // Test 8: SUBSCRIPTION_FAILED event
    it('successfully processes SUBSCRIPTION_FAILED event', async () => {
      const reference = makeRef();
      const payload = {
        event_type: 'SUBSCRIPTION_FAILED',
        customer_id: TEST_CUSTOMER_ID,
        payment_reference: reference,
        amount: 2999,
        timestamp: new Date().toISOString(),
        metadata: {}
      };

      const response = await fetch(`${BASE_URL}/api/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.data.revenue_at_risk).toBe(2999);
      expect(json.data.event_type).toBe('SUBSCRIPTION_FAILED');
    });

    // Test 9: INVOICE_OVERDUE event
    it('successfully processes INVOICE_OVERDUE event', async () => {
      const reference = makeRef();
      const payload = {
        event_type: 'INVOICE_OVERDUE',
        customer_id: TEST_CUSTOMER_ID,
        payment_reference: reference,
        amount: 8500,
        timestamp: new Date().toISOString(),
        metadata: {}
      };

      const response = await fetch(`${BASE_URL}/api/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.data.revenue_at_risk).toBe(8500);
      expect(json.data.event_type).toBe('INVOICE_OVERDUE');
    });

    // Test 14: Demo payment-failure endpoint
    it('creates a demo payment failure event, payment, and recovery case via /api/demo/payment-failure', async () => {
      const response = await fetch(`${BASE_URL}/api/demo/payment-failure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(isUuid(json.data.event_id)).toBe(true);
      expect(json.data.event_type).toBe('PAYMENT_FAILED');
      expect(json.data.customer_id).toBe(TEST_CUSTOMER_ID);
      expect(json.data.amount).toBe(12500);
      expect(json.data.revenue_at_risk).toBe(12500);
      expect(isUuid(json.data.recovery_case_id)).toBe(true);
      expect(json.data.status).toBe('processed');
    });

    // Test 15: Duplicate/repeated event handling
    it('handles duplicate events gracefully without creating duplicate payment/case records', async () => {
      const duplicateRef = makeRef();
      const payload = {
        event_type: 'PAYMENT_FAILED',
        customer_id: TEST_CUSTOMER_ID,
        payment_reference: duplicateRef,
        amount: 1000,
        timestamp: new Date().toISOString(),
        metadata: {}
      };

      // Ingest the event first time
      const response1 = await fetch(`${BASE_URL}/api/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json1 = await response1.json();
      const initialCaseId = json1.data.recovery_case_id;

      // Ingest the event second time
      const response2 = await fetch(`${BASE_URL}/api/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json2 = await response2.json();
      const finalCaseId = json2.data.recovery_case_id;

      // Case ID must be identical
      expect(initialCaseId).toBe(finalCaseId);

      // Verify DB counts (should only be 1 payment and 1 case for this reference)
      const { data: payments } = await supabase
        .from('payments')
        .select('id')
        .eq('razorpay_payment_id', duplicateRef);
      expect(payments.length).toBe(1);

      const { data: cases } = await supabase
        .from('recovery_cases')
        .select('id')
        .eq('payment_id', payments[0].id);
      expect(cases.length).toBe(1);
    });

  });
});
