/**
 * RazorRecover — Module 7 Backend Payment Execution Service
 * 
 * Authoritative payment execution layer, database state updater, idempotency validator,
 * guardrails enforcer, and webhook handler.
 */

const { supabase } = require('../config/supabase');
const { MockPaymentProvider, RazorpayProvider } = require('./paymentProvider');

const HIGH_VALUE_THRESHOLD = 50000.0;
const MAX_RETRIES = 3;
const ALLOWED_ACTIONS = [
  'RETRY_PAYMENT',
  'SEND_REMINDER',
  'SEND_PAYMENT_LINK',
  'WAIT_AND_RETRY',
  'ESCALATE_TO_HUMAN',
  'STOP'
];

class PaymentService {
  constructor() {
    this.mockProvider = new MockPaymentProvider();
    this.razorpayProvider = new RazorpayProvider();
    this.activeProvider = this.mockProvider; // Default and ONLY active provider in Module 7
  }

  /**
   * Evaluates deterministic guardrails before executing an action.
   */
  async checkGuardrails(caseData, paymentData, customerData, action, retryCount = 0) {
    const txAmount = Number(paymentData.amount || caseData.revenue_at_risk || 0.0);
    const isOptedOut = Boolean(customerData.opted_out || customerData.notes?.opted_out);
    const caseStatus = (caseData.status || '').toLowerCase();
    const paymentStatus = (paymentData.status || '').toLowerCase();

    // 1. Action Validity Check
    if (!ALLOWED_ACTIONS.includes(action)) {
      return {
        passed: false,
        status: 'REJECTED',
        reason: `Invalid action '${action}'. Rejected by guardrails.`,
        action: 'STOP'
      };
    }

    // 2. Already Closed / Recovered Check
    if (['recovered', 'captured'].includes(caseStatus) || paymentStatus === 'captured') {
      return {
        passed: false,
        status: 'STOPPED',
        reason: 'Payment already captured/recovered. Automated recovery stopped.',
        action: 'STOP'
      };
    }

    // 3. Customer Opt-Out Check
    if (isOptedOut) {
      return {
        passed: false,
        status: 'STOPPED',
        reason: 'Customer has opted out of automated recovery communications.',
        action: 'STOP'
      };
    }

    // 4. High-Value Transaction Check (Requires Human Approval)
    if (txAmount >= HIGH_VALUE_THRESHOLD) {
      return {
        passed: false,
        status: 'FLAGGED_FOR_HUMAN',
        reason: `Transaction amount ₹${txAmount.toLocaleString()} exceeds high-value threshold ₹${HIGH_VALUE_THRESHOLD.toLocaleString()}. Human approval required.`,
        action: 'ESCALATE_TO_HUMAN'
      };
    }

    // 5. Maximum Retry Count Check
    if (['RETRY_PAYMENT', 'WAIT_AND_RETRY'].includes(action) && retryCount >= MAX_RETRIES) {
      return {
        passed: false,
        status: 'ESCALATED',
        reason: `Retry count (${retryCount}) reached maximum limit of ${MAX_RETRIES}. Escalated to human team.`,
        action: 'ESCALATE_TO_HUMAN'
      };
    }

    return {
      passed: true,
      status: 'APPROVED',
      reason: 'All deterministic safety guardrails passed.',
      action
    };
  }

  /**
   * Helper to write audit log entry into DB
   */
  async logAudit(eventType, entityType, entityId, actor, details, severity = 'info') {
    try {
      await supabase.from('audit_logs').insert({
        event_type: eventType,
        entity_type: entityType,
        entity_id: entityId,
        actor,
        details,
        severity,
        created_at: new Date().toISOString()
      });
    } catch (err) {
      console.warn(`⚠️ Audit log insertion warning: ${err.message}`);
    }
  }

  /**
   * Executes payment recovery action for a recovery case.
   */
  async executeRecoveryAction(caseId, actionOptions = {}) {
    const {
      action = 'RETRY_PAYMENT',
      simulate_success = true,
      simulate_status,
      idempotency_key
    } = actionOptions;

    // Check idempotency first if key provided
    if (idempotency_key) {
      const { data: existingAttempts } = await supabase
        .from('recovery_attempts')
        .select('*')
        .eq('idempotency_key', idempotency_key);

      if (existingAttempts && existingAttempts.length > 0) {
        const prev = existingAttempts[0];
        return {
          success: true,
          is_duplicate: true,
          message: 'Idempotency key match: execution already processed.',
          data: {
            attempt_id: prev.id,
            case_id: prev.case_id,
            status: prev.status,
            transaction_reference: prev.transaction_reference,
            actual_amount: prev.actual_amount,
            executed_at: prev.executed_at
          }
        };
      }
    }

    // Fetch Case, Payment, and Customer details
    const { data: caseRows, error: caseErr } = await supabase
      .from('recovery_cases')
      .select('*, payments(*), customers(*)')
      .eq('id', caseId);

    if (caseErr || !caseRows || caseRows.length === 0) {
      const err = new Error(`Recovery case '${caseId}' not found.`);
      err.statusCode = 404;
      throw err;
    }

    const recoveryCase = caseRows[0];
    const payment = recoveryCase.payments || {};
    const customer = recoveryCase.customers || {};

    // Get count of existing retries
    const { data: attempts } = await supabase
      .from('recovery_attempts')
      .select('id, strategy, status')
      .eq('case_id', caseId);

    const retryCount = (attempts || []).filter(a => ['retry', 'RETRY_PAYMENT'].includes(a.strategy)).length;

    // Run Guardrails Validation
    const guardrail = await this.checkGuardrails(recoveryCase, payment, customer, action, retryCount);

    await this.logAudit('guardrail_evaluated', 'recovery_case', caseId, 'system', {
      action,
      decision: guardrail.status,
      reason: guardrail.reason
    }, guardrail.passed ? 'info' : 'warning');

    if (!guardrail.passed) {
      // Record guardrail rejection attempt & update case if escalated
      if (guardrail.action === 'ESCALATE_TO_HUMAN') {
        await supabase
          .from('recovery_cases')
          .update({
            status: 'escalated',
            escalated_to_human: true,
            escalated_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', caseId);
      }

      const { error: guardrailErr } = await supabase.from('recovery_attempts').insert({
        case_id: caseId,
        payment_id: payment.id,
        strategy: 'retry',
        action: action,
        status: 'skipped',
        safety_check_passed: false,
        guardrail_notes: guardrail.reason,
        attempt_number: retryCount + 1,
        max_attempts: MAX_RETRIES,
        idempotency_key,
        executed_at: new Date().toISOString(),
        is_demo: true
      });

      if (guardrailErr) {
        console.error(`❌ Error persisting skipped recovery_attempt for case ${caseId}: ${guardrailErr.message}`);
      }

      return {
        success: false,
        guardrail_status: guardrail.status,
        reason: guardrail.reason,
        enforced_action: guardrail.action
      };
    }

    // Execute via Provider for RETRY_PAYMENT
    const txAmount = Number(payment.amount || recoveryCase.revenue_at_risk || 0.0);
    let executionResult;

    if (action === 'RETRY_PAYMENT') {
      executionResult = await this.activeProvider.retryPayment(
        payment.id,
        caseId,
        txAmount,
        payment.error_reason || 'insufficient_funds',
        { simulate_success, simulate_status, idempotency_key }
      );

      const pmtStatus = executionResult.status; // SUCCESS, FAILED, PENDING, CANCELLED
      const isSuccess = pmtStatus === 'SUCCESS';

      // DB Updates
      const attemptStatus = isSuccess ? 'success' : 'failed';
      const actualAmount = isSuccess ? txAmount : 0.0;

      // Insert recovery attempt record
      const { data: insertedAttempt, error: attemptErr } = await supabase
        .from('recovery_attempts')
        .insert({
          case_id: caseId,
          payment_id: payment.id,
          strategy: 'retry',
          action: action || 'RETRY_PAYMENT',
          status: attemptStatus,
          predicted_amount: txAmount,
          actual_amount: actualAmount,
          provider: 'mock',
          transaction_reference: executionResult.transaction_reference,
          safety_check_passed: true,
          guardrail_notes: guardrail.reason,
          attempt_number: retryCount + 1,
          max_attempts: MAX_RETRIES,
          idempotency_key,
          executed_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          is_demo: true
        })
        .select();

      if (attemptErr) {
        console.error(`❌ Error persisting recovery_attempt for case ${caseId}: ${attemptErr.message}`);
        throw new Error(`Failed to persist recovery_attempt: ${attemptErr.message}`);
      }

      // Audit logs
      await this.logAudit('payment_retry_requested', 'recovery_case', caseId, 'ai_agent', { action, txAmount });
      await this.logAudit('payment_execution', 'payment', payment.id, 'system', executionResult);

      if (isSuccess) {
        // Update payment table
        await supabase
          .from('payments')
          .update({
            status: 'captured',
            provider: 'mock',
            transaction_reference: executionResult.transaction_reference,
            updated_at: new Date().toISOString()
          })
          .eq('id', payment.id);

        // Update recovery_cases table: recovered_amount = actual successful amount ONLY
        await supabase
          .from('recovery_cases')
          .update({
            status: 'recovered',
            recovered_amount: txAmount,
            revenue_at_risk: 0.0,
            strategy: 'retry',
            updated_at: new Date().toISOString()
          })
          .eq('id', caseId);

        await this.logAudit('payment_success', 'payment', payment.id, 'mock_provider', { transaction_reference: executionResult.transaction_reference });
        await this.logAudit('revenue_recovered', 'recovery_case', caseId, 'system', { recovered_amount: txAmount });
        await this.logAudit('recovery_workflow_stopped', 'recovery_case', caseId, 'system', { reason: 'Payment successfully recovered.' });

        return {
          success: true,
          status: 'RECOVERED',
          recovered_amount: txAmount,
          transaction_reference: executionResult.transaction_reference,
          attempt: insertedAttempt ? insertedAttempt[0] : null,
          execution_result: executionResult
        };
      } else {
        // Failed attempt
        const newRetryCount = retryCount + 1;
        const newStatus = newRetryCount >= MAX_RETRIES ? 'escalated' : 'in_recovery';

        await supabase
          .from('recovery_cases')
          .update({
            status: newStatus,
            escalated_to_human: newRetryCount >= MAX_RETRIES,
            escalated_at: newRetryCount >= MAX_RETRIES ? new Date().toISOString() : null,
            updated_at: new Date().toISOString()
          })
          .eq('id', caseId);

        await this.logAudit('payment_failed', 'payment', payment.id, 'mock_provider', { reason: executionResult.failure_reason });

        if (newRetryCount >= MAX_RETRIES) {
          await this.logAudit('recovery_escalated', 'recovery_case', caseId, 'system', { reason: 'Max retries reached' });
        }

        return {
          success: false,
          status: newStatus.toUpperCase(),
          recovered_amount: 0.0,
          transaction_reference: executionResult.transaction_reference,
          attempt: insertedAttempt ? insertedAttempt[0] : null,
          execution_result: executionResult
        };
      }
    } else {
      // Non-payment action (SEND_REMINDER, SEND_PAYMENT_LINK, WAIT_AND_RETRY, ESCALATE_TO_HUMAN, STOP)
      let attemptStrategy = 'reminder_email';
      if (action === 'SEND_PAYMENT_LINK') attemptStrategy = 'payment_link';
      else if (action === 'WAIT_AND_RETRY') attemptStrategy = 'retry';

      const { data: insertedAttempt, error: attemptErr } = await supabase
        .from('recovery_attempts')
        .insert({
          case_id: caseId,
          payment_id: payment.id,
          strategy: attemptStrategy,
          action: action,
          status: action === 'ESCALATE_TO_HUMAN' ? 'failed' : 'in_progress',
          safety_check_passed: true,
          guardrail_notes: guardrail.reason,
          attempt_number: retryCount + 1,
          max_attempts: MAX_RETRIES,
          idempotency_key,
          executed_at: new Date().toISOString(),
          is_demo: true
        })
        .select();

      if (attemptErr) {
        console.error(`❌ Error persisting recovery_attempt for case ${caseId}: ${attemptErr.message}`);
        throw new Error(`Failed to persist recovery_attempt: ${attemptErr.message}`);
      }

      await this.logAudit('action_simulated', 'recovery_case', caseId, 'ai_agent', { action });

      return {
        success: true,
        status: action === 'ESCALATE_TO_HUMAN' ? 'ESCALATED' : 'SIMULATED',
        action,
        attempt: insertedAttempt ? insertedAttempt[0] : null
      };
    }
  }

  /**
   * Processes webhook events idempotently.
   */
  async processWebhookEvent(eventPayload) {
    const { event, payload = {}, idempotency_key, event_id } = eventPayload;
    const key = idempotency_key || event_id || payload.transaction_reference;

    if (!event) {
      const err = new Error("Webhook event name is required (e.g. 'payment.success').");
      err.statusCode = 400;
      throw err;
    }

    // Check duplicate event via idempotency key in audit logs or attempts
    if (key) {
      const { data: existingAudits } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('event_type', `webhook_${event}`)
        .filter('details->>idempotency_key', 'eq', key);

      if (existingAudits && existingAudits.length > 0) {
        return {
          success: true,
          status: 'ignored',
          reason: 'duplicate_event',
          message: `Webhook event '${key}' has already been processed.`
        };
      }
    }

    const caseId = payload.case_id;
    const paymentId = payload.payment_id;
    const txRef = payload.transaction_reference || `MOCK_PAY_WEBHOOK_${Date.now()}`;
    const amount = Number(payload.amount || 0);

    await this.logAudit(`webhook_${event}`, 'webhook', caseId || paymentId, 'system', {
      event,
      payload,
      idempotency_key: key
    });

    if (event === 'payment.success') {
      if (paymentId) {
        await supabase
          .from('payments')
          .update({
            status: 'captured',
            provider: 'mock',
            transaction_reference: txRef,
            updated_at: new Date().toISOString()
          })
          .eq('id', paymentId);
      }

      if (caseId) {
        await supabase
          .from('recovery_cases')
          .update({
            status: 'recovered',
            recovered_amount: amount > 0 ? amount : supabase.raw ? undefined : amount,
            revenue_at_risk: 0.0,
            updated_at: new Date().toISOString()
          })
          .eq('id', caseId);

        await this.logAudit('payment_success', 'recovery_case', caseId, 'webhook', { amount, txRef });
        await this.logAudit('revenue_recovered', 'recovery_case', caseId, 'webhook', { recovered_amount: amount });
        await this.logAudit('recovery_workflow_stopped', 'recovery_case', caseId, 'webhook', { reason: 'Webhook confirmed payment success.' });
      }

      return {
        success: true,
        status: 'processed',
        event,
        recovered_amount: amount,
        transaction_reference: txRef
      };
    } else if (event === 'payment.failed') {
      if (paymentId) {
        await supabase
          .from('payments')
          .update({
            status: 'failed',
            provider: 'mock',
            transaction_reference: txRef,
            updated_at: new Date().toISOString()
          })
          .eq('id', paymentId);
      }

      return {
        success: true,
        status: 'processed',
        event,
        transaction_reference: txRef
      };
    } else if (['payment.pending', 'payment.cancelled'].includes(event)) {
      return {
        success: true,
        status: 'processed',
        event,
        transaction_reference: txRef
      };
    }

    return {
      success: true,
      status: 'unhandled_event',
      event
    };
  }

  /**
   * Retrieves complete recovery status for a case.
   */
  async getCaseStatus(caseId) {
    const { data: cases, error } = await supabase
      .from('recovery_cases')
      .select('*, payments(*), customers(*)')
      .eq('id', caseId);

    if (error || !cases || cases.length === 0) {
      const err = new Error(`Recovery case '${caseId}' not found.`);
      err.statusCode = 404;
      throw err;
    }

    const caseData = cases[0];

    const { data: attempts } = await supabase
      .from('recovery_attempts')
      .select('*')
      .eq('case_id', caseId)
      .order('created_at', { ascending: true });

    const { data: auditLogs } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('entity_id', caseId)
      .order('created_at', { ascending: true });

    return {
      success: true,
      data: {
        recovery_case: caseData,
        payment: caseData.payments,
        customer: caseData.customers,
        attempts: attempts || [],
        audit_logs: auditLogs || [],
        provider: 'mock',
        status: caseData.status,
        recovered_amount: Number(caseData.recovered_amount || 0.0),
        revenue_at_risk: Number(caseData.revenue_at_risk || 0.0)
      }
    };
  }
}

module.exports = new PaymentService();
