/**
 * RazorRecover — Module 7 Payment Provider Abstraction Layer
 * 
 * Defines the core PaymentProvider base abstraction, the deterministic MockPaymentProvider,
 * and an inactive optional RazorpayProvider placeholder.
 */

const crypto = require('crypto');

/**
 * PaymentProvider — Abstract Base Class
 */
class PaymentProvider {
  constructor(name = 'base') {
    this.name = name;
  }

  async createPaymentAttempt(caseId, amount, method = 'card', metadata = {}) {
    throw new Error('PaymentProvider.createPaymentAttempt must be implemented by subclass');
  }

  async retryPayment(paymentId, caseId, amount, failureType = 'TEMPORARY_PAYMENT_FAILURE', metadata = {}) {
    throw new Error('PaymentProvider.retryPayment must be implemented by subclass');
  }

  async getPaymentStatus(transactionReference) {
    throw new Error('PaymentProvider.getPaymentStatus must be implemented by subclass');
  }

  async simulatePaymentResult(transactionReference, targetStatus = 'SUCCESS') {
    throw new Error('PaymentProvider.simulatePaymentResult must be implemented by subclass');
  }
}

/**
 * MockPaymentProvider — Deterministic Offline Mock Execution Layer
 */
class MockPaymentProvider extends PaymentProvider {
  constructor() {
    super('mock');
    this.transactions = new Map();
  }

  /**
   * Generates unique reference ID: MOCK_PAY_XXXXXXXX
   */
  _generateMockTransactionId() {
    const randomHex = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `MOCK_PAY_${randomHex}`;
  }

  async createPaymentAttempt(caseId, amount, method = 'card', metadata = {}) {
    const txId = this._generateMockTransactionId();
    const status = metadata.simulate_status || (metadata.simulate_success === false ? 'FAILED' : 'SUCCESS');
    
    const record = {
      transaction_reference: txId,
      provider: 'mock',
      case_id: caseId,
      amount: Number(amount),
      method,
      status: status.toUpperCase(),
      failure_reason: status.toUpperCase() === 'FAILED' ? (metadata.failure_reason || 'Mock payment failure simulated') : null,
      is_demo: true,
      mode: 'SIMULATION',
      is_simulation: true,
      timestamp: new Date().toISOString(),
      metadata
    };

    this.transactions.set(txId, record);
    return record;
  }

  async retryPayment(paymentId, caseId, amount, failureType = 'TEMPORARY_PAYMENT_FAILURE', metadata = {}) {
    const txId = this._generateMockTransactionId();
    
    // Deterministic simulation outcome
    let status = 'SUCCESS';
    if (metadata.simulate_status) {
      status = metadata.simulate_status.toUpperCase();
    } else if (metadata.simulate_success === false) {
      status = 'FAILED';
    }

    const validStatuses = ['SUCCESS', 'FAILED', 'PENDING', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      status = 'FAILED';
    }

    const record = {
      transaction_reference: txId,
      payment_id: paymentId,
      case_id: caseId,
      provider: 'mock',
      amount: Number(amount),
      status,
      failure_reason: status === 'FAILED' ? (failureType || 'SIMULATED_RETRY_FAILURE') : null,
      is_demo: true,
      mode: 'SIMULATION',
      is_simulation: true,
      timestamp: new Date().toISOString(),
      metadata
    };

    this.transactions.set(txId, record);
    return record;
  }

  async getPaymentStatus(transactionReference) {
    if (this.transactions.has(transactionReference)) {
      return this.transactions.get(transactionReference);
    }
    return {
      transaction_reference: transactionReference,
      provider: 'mock',
      status: 'UNKNOWN',
      is_demo: true,
      mode: 'SIMULATION',
      is_simulation: true,
      timestamp: new Date().toISOString()
    };
  }

  async simulatePaymentResult(transactionReference, targetStatus = 'SUCCESS') {
    const validStatuses = ['SUCCESS', 'FAILED', 'PENDING', 'CANCELLED'];
    const status = targetStatus.toUpperCase();
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid status '${targetStatus}'. Must be one of: ${validStatuses.join(', ')}`);
    }

    const record = this.transactions.get(transactionReference) || {
      transaction_reference: transactionReference,
      provider: 'mock',
      amount: 0,
      is_demo: true,
      mode: 'SIMULATION',
      is_simulation: true,
    };

    record.status = status;
    record.timestamp = new Date().toISOString();
    this.transactions.set(transactionReference, record);
    return record;
  }
}

/**
 * RazorpayProvider — Optional / Inactive Future Placeholder
 */
class RazorpayProvider extends PaymentProvider {
  constructor() {
    super('razorpay');
    this.keyId = process.env.RAZORPAY_KEY_ID;
    this.keySecret = process.env.RAZORPAY_KEY_SECRET;
  }

  _ensureConfigured() {
    if (!this.keyId || !this.keySecret) {
      throw new Error(
        'RazorpayProvider is unconfigured and inactive in Module 7. ' +
        'No Razorpay credentials are present. Active execution flow must use MockPaymentProvider.'
      );
    }
  }

  async createPaymentAttempt() {
    this._ensureConfigured();
    throw new Error('Razorpay API integration is inactive in Module 7.');
  }

  async retryPayment() {
    this._ensureConfigured();
    throw new Error('Razorpay API integration is inactive in Module 7.');
  }

  async getPaymentStatus() {
    this._ensureConfigured();
    throw new Error('Razorpay API integration is inactive in Module 7.');
  }

  async simulatePaymentResult() {
    this._ensureConfigured();
    throw new Error('Razorpay API integration is inactive in Module 7.');
  }
}

module.exports = {
  PaymentProvider,
  MockPaymentProvider,
  RazorpayProvider
};
