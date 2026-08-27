const { supabase } = require('../config/supabase');

/**
 * Validates if a string is a valid UUID.
 */
function isUuid(val) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
}

/**
 * Validates the event payload structure.
 * Throws an error with statusCode if invalid.
 */
async function validateEvent(data) {
  const { event_type, customer_id, payment_reference, amount, timestamp, metadata } = data;

  // 1. Validate event_type
  const supportedTypes = ['PAYMENT_FAILED', 'PAYMENT_SUCCESS', 'CHECKOUT_ABANDONED', 'SUBSCRIPTION_FAILED', 'INVOICE_OVERDUE'];
  if (!event_type || !supportedTypes.includes(event_type)) {
    const err = new Error(`Unsupported event type: ${event_type || 'undefined'}`);
    err.statusCode = 400;
    throw err;
  }

  // 2. Validate customer_id format
  if (!customer_id || !isUuid(customer_id)) {
    const err = new Error('Invalid customer_id format. Must be a valid UUID.');
    err.statusCode = 400;
    throw err;
  }

  // 3. Validate customer exists in the database
  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .select('id')
    .eq('id', customer_id)
    .limit(1);

  if (customerError) {
    const err = new Error(`Database error while validating customer: ${customerError.message}`);
    err.statusCode = 500;
    throw err;
  }

  if (!customer || customer.length === 0) {
    const err = new Error(`Customer with ID ${customer_id} does not exist.`);
    err.statusCode = 400;
    throw err;
  }

  // 4. Validate payment_reference format
  if (!payment_reference || typeof payment_reference !== 'string' || payment_reference.trim() === '') {
    const err = new Error('Invalid payment_reference. Must be a non-empty string.');
    err.statusCode = 400;
    throw err;
  }

  // 5. Validate amount format where applicable
  if (amount === undefined || amount === null || typeof amount !== 'number' || amount < 0) {
    const err = new Error('Invalid amount. Must be a non-negative number.');
    err.statusCode = 400;
    throw err;
  }

  // 6. Validate timestamp format
  if (!timestamp || isNaN(Date.parse(timestamp))) {
    const err = new Error('Invalid timestamp format. Must be a valid ISO timestamp.');
    err.statusCode = 400;
    throw err;
  }

  // 7. Validate metadata format
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    const err = new Error('Invalid metadata format. Must be a valid JSON object.');
    err.statusCode = 400;
    throw err;
  }

  return true;
}

/**
 * Deterministically calculates the revenue at risk for an event type and amount.
 */
function calculateRevenueAtRisk(eventType, amount) {
  const numericAmount = parseFloat(amount);
  if (isNaN(numericAmount) || numericAmount < 0) {
    return 0.00;
  }

  switch (eventType) {
    case 'PAYMENT_FAILED':
    case 'CHECKOUT_ABANDONED':
    case 'SUBSCRIPTION_FAILED':
    case 'INVOICE_OVERDUE':
      return numericAmount;
    case 'PAYMENT_SUCCESS':
      return 0.00;
    default:
      return 0.00;
  }
}

/**
 * Maps a revenue event type to its corresponding payment status in the database.
 */
function mapEventToPaymentStatus(eventType) {
  switch (eventType) {
    case 'PAYMENT_SUCCESS':
      return 'captured';
    case 'PAYMENT_FAILED':
      return 'failed';
    case 'CHECKOUT_ABANDONED':
      return 'failed_checkout';
    case 'SUBSCRIPTION_FAILED':
      return 'failed';
    case 'INVOICE_OVERDUE':
      return 'failed';
    default:
      return 'created';
  }
}

/**
 * Processes a validated revenue event.
 * Stores event, updates/creates payment record, updates/creates recovery case, and writes audit log.
 */
async function processEvent(eventData, options = {}) {
  const { event_type, customer_id, payment_reference, amount, timestamp, metadata } = eventData;
  const isDemo = options.isDemo === true;

  // 1. Store event in revenue_events table
  const { data: storedEvent, error: eventInsertError } = await supabase
    .from('revenue_events')
    .insert({
      event_type,
      customer_id,
      payment_reference,
      invoice_reference: (event_type === 'INVOICE_OVERDUE' || event_type === 'SUBSCRIPTION_FAILED') ? payment_reference : null,
      amount,
      timestamp,
      metadata
    })
    .select()
    .single();

  if (eventInsertError) {
    const err = new Error(`Failed to store event: ${eventInsertError.message}`);
    err.statusCode = 500;
    throw err;
  }

  // 2. Find or create payment record
  let paymentId = null;
  const targetStatus = mapEventToPaymentStatus(event_type);

  // Search existing payments
  let paymentQuery = supabase.from('payments').select('id, status, is_demo');
  if (isUuid(payment_reference)) {
    paymentQuery = paymentQuery.eq('id', payment_reference);
  } else {
    paymentQuery = paymentQuery.eq('razorpay_payment_id', payment_reference);
  }
  
  const { data: paymentsFound, error: paymentFindError } = await paymentQuery.limit(1);
  if (paymentFindError) {
    const err = new Error(`Database error looking up payment: ${paymentFindError.message}`);
    err.statusCode = 500;
    throw err;
  }

  const existingPayment = paymentsFound && paymentsFound.length > 0 ? paymentsFound[0] : null;

  if (existingPayment) {
    paymentId = existingPayment.id;
    // Update status if it differs
    if (existingPayment.status !== targetStatus) {
      const { error: updatePayError } = await supabase
        .from('payments')
        .update({ 
          status: targetStatus, 
          updated_at: new Date().toISOString() 
        })
        .eq('id', paymentId);

      if (updatePayError) {
        const err = new Error(`Failed to update payment status: ${updatePayError.message}`);
        err.statusCode = 500;
        throw err;
      }
    }
  } else {
    // Insert new minimum valid payment record
    const newPaymentData = {
      customer_id,
      amount,
      status: targetStatus,
      currency: metadata.currency || 'INR',
      is_demo: isDemo,
      created_at: timestamp,
      updated_at: new Date().toISOString()
    };

    if (isUuid(payment_reference)) {
      newPaymentData.id = payment_reference;
    } else {
      newPaymentData.razorpay_payment_id = payment_reference;
    }

    const { data: insertedPayment, error: insertPayError } = await supabase
      .from('payments')
      .insert(newPaymentData)
      .select()
      .single();

    if (insertPayError) {
      const err = new Error(`Failed to create payment record: ${insertPayError.message}`);
      err.statusCode = 500;
      throw err;
    }
    paymentId = insertedPayment.id;
  }

  // 3. Find existing recovery case associated with this specific payment
  const { data: casesFound, error: caseFindError } = await supabase
    .from('recovery_cases')
    .select('id, status')
    .eq('payment_id', paymentId)
    .limit(1);

  if (caseFindError) {
    const err = new Error(`Database error looking up recovery case: ${caseFindError.message}`);
    err.statusCode = 500;
    throw err;
  }

  const existingCase = casesFound && casesFound.length > 0 ? casesFound[0] : null;
  const revenueAtRisk = calculateRevenueAtRisk(event_type, amount);
  let recoveryCaseId = null;

  if (event_type === 'PAYMENT_SUCCESS') {
    if (existingCase) {
      // Resolve only the matching recovery case
      const { data: updatedCase, error: updateCaseError } = await supabase
        .from('recovery_cases')
        .update({
          status: 'recovered',
          revenue_at_risk: 0.00,
          recovered_amount: amount,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingCase.id)
        .select()
        .single();

      if (updateCaseError) {
        const err = new Error(`Failed to resolve recovery case: ${updateCaseError.message}`);
        err.statusCode = 500;
        throw err;
      }
      recoveryCaseId = updatedCase.id;
    }
    // If no matching case exists for PAYMENT_SUCCESS, do not create one.
  } else {
    // Revenue-risk event types
    if (existingCase) {
      // Update existing case
      const { data: updatedCase, error: updateCaseError } = await supabase
        .from('recovery_cases')
        .update({
          revenue_at_risk: revenueAtRisk,
          status: (existingCase.status === 'recovered' || existingCase.status === 'closed') ? 'open' : existingCase.status,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingCase.id)
        .select()
        .single();

      if (updateCaseError) {
        const err = new Error(`Failed to update recovery case: ${updateCaseError.message}`);
        err.statusCode = 500;
        throw err;
      }
      recoveryCaseId = updatedCase.id;
    } else {
      // Create a new recovery case
      const { data: insertedCase, error: insertCaseError } = await supabase
        .from('recovery_cases')
        .insert({
          payment_id: paymentId,
          customer_id,
          status: 'open',
          revenue_at_risk: revenueAtRisk,
          recovered_amount: 0.00,
          created_at: timestamp,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (insertCaseError) {
        const err = new Error(`Failed to create recovery case: ${insertCaseError.message}`);
        err.statusCode = 500;
        throw err;
      }
      recoveryCaseId = insertedCase.id;
    }
  }

  // 4. Write audit log using the existing audit_logs structure
  const auditEvent = event_type.toLowerCase();
  const { error: auditError } = await supabase
    .from('audit_logs')
    .insert({
      event_type: auditEvent,
      entity_type: recoveryCaseId ? 'recovery_case' : 'payment',
      entity_id: recoveryCaseId || paymentId,
      actor: 'system',
      severity: event_type === 'PAYMENT_SUCCESS' ? 'info' : 'warning',
      details: {
        event_id: storedEvent.id,
        event_type,
        customer_id,
        revenue_at_risk: revenueAtRisk,
        amount,
        payment_reference,
        timestamp,
        metadata
      }
    });

  if (auditError) {
    const err = new Error(`Failed to write audit log: ${auditError.message}`);
    err.statusCode = 500;
    throw err;
  }

  return {
    event_id: storedEvent.id,
    event_type,
    revenue_at_risk: revenueAtRisk,
    recovery_case_id: recoveryCaseId,
    status: 'processed'
  };
}

module.exports = {
  validateEvent,
  calculateRevenueAtRisk,
  processEvent,
  isUuid
};
