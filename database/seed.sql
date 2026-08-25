-- Seed Data for RazorRecover
-- Creates mock customers, subscriptions, invoices, payments, and recovery history.

-- Clear existing data (in dependency order)
TRUNCATE TABLE audit_logs CASCADE;
TRUNCATE TABLE notifications CASCADE;
TRUNCATE TABLE ai_decisions CASCADE;
TRUNCATE TABLE ai_predictions CASCADE;
TRUNCATE TABLE recovery_attempts CASCADE;
TRUNCATE TABLE recovery_cases CASCADE;
TRUNCATE TABLE payments CASCADE;
TRUNCATE TABLE invoices CASCADE;
TRUNCATE TABLE subscriptions CASCADE;
TRUNCATE TABLE customers CASCADE;

-- 1. Insert Customers (Prefix: 00000000)
INSERT INTO customers (id, name, email, phone, notes) VALUES
('00000000-0000-0000-0000-000000000001', 'Alice Johnson', 'alice.johnson@example.com', '+919876543210', '{"company": "Alice Tech", "tier": "Pro"}'),
('00000000-0000-0000-0000-000000000002', 'Bob Smith', 'bob.smith@example.com', '+919876543211', '{"company": "Smith Logistics", "tier": "Enterprise"}'),
('00000000-0000-0000-0000-000000000003', 'Charlie Brown', 'charlie.brown@example.com', '+919876543212', '{"company": "Peanuts Inc", "tier": "Basic"}'),
('00000000-0000-0000-0000-000000000004', 'Diana Prince', 'diana.prince@example.com', '+919876543213', '{"company": "Themyscira Corp", "tier": "Pro"}'),
('00000000-0000-0000-0000-000000000005', 'Evan Wright', 'evan.wright@example.com', '+919876543214', '{"company": "Wright Solutions", "tier": "Pro"}');

-- 2. Insert Subscriptions (Prefix: 11111111)
INSERT INTO subscriptions (id, customer_id, status, plan_name, plan_amount, currency, current_period_start, current_period_end) VALUES
('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001', 'active', 'Pro Monthly', 1500.00, 'INR', NOW() - INTERVAL '15 days', NOW() + INTERVAL '15 days'),
('11111111-1111-1111-1111-111111111112', '00000000-0000-0000-0000-000000000002', 'past_due', 'Enterprise Annual', 12500.00, 'INR', NOW() - INTERVAL '30 days', NOW() - INTERVAL '1 day'),
('11111111-1111-1111-1111-111111111113', '00000000-0000-0000-0000-000000000003', 'canceled', 'Developer Lite', 500.00, 'INR', NOW() - INTERVAL '60 days', NOW() - INTERVAL '30 days'),
('11111111-1111-1111-1111-111111111115', '00000000-0000-0000-0000-000000000005', 'active', 'Pro Monthly', 4500.00, 'INR', NOW() - INTERVAL '10 days', NOW() + INTERVAL '20 days');

-- 3. Insert Invoices (Prefix: 22222222)
INSERT INTO invoices (id, customer_id, subscription_id, amount, currency, status, due_date) VALUES
('22222222-2222-2222-2222-222222222211', '00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 1500.00, 'INR', 'paid', NOW() - INTERVAL '15 days'),
('22222222-2222-2222-2222-222222222212', '00000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111112', 12500.00, 'INR', 'overdue', NOW() - INTERVAL '5 days'),
('22222222-2222-2222-2222-222222222213', '00000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111113', 500.00, 'INR', 'uncollectible', NOW() - INTERVAL '35 days'),
('22222222-2222-2222-2222-222222222215', '00000000-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111115', 4500.00, 'INR', 'paid', NOW() - INTERVAL '10 days');

-- 4. Insert Payments (Prefix: 33333333)
INSERT INTO payments (id, customer_id, subscription_id, invoice_id, razorpay_payment_id, razorpay_order_id, amount, currency, status, method, email, contact, error_code, error_description, error_source, error_step, error_reason, is_demo) VALUES
-- Successful payment (Alice Johnson)
('33333333-3333-3333-3333-333333333301', '00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222211', 'pay_successful_123', 'order_123', 1500.00, 'INR', 'captured', 'card', 'alice.johnson@example.com', '+919876543210', NULL, NULL, NULL, NULL, NULL, TRUE),

-- Failed payment (Recoverable - Bob Smith - Insufficient Funds)
('33333333-3333-3333-3333-333333333302', '00000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111112', '22222222-2222-2222-2222-222222222212', 'pay_failed_bob_insufficient', 'order_bob_001', 12500.00, 'INR', 'failed', 'card', 'bob.smith@example.com', '+919876543211', 'bad_request_payment_declined_by_bank', 'The card has insufficient funds', 'customer', 'payment_processing', 'insufficient_funds', TRUE),

-- Failed payment (Unrecoverable - Charlie Brown - Auth Failed)
('33333333-3333-3333-3333-333333333303', '00000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111113', '22222222-2222-2222-2222-222222222213', 'pay_failed_charlie_auth', 'order_charlie_001', 500.00, 'INR', 'failed', 'upi', 'charlie.brown@example.com', '+919876543212', 'payment_failed', 'Authentication failed', 'customer', 'payment_authentication', 'authentication_failed', TRUE),

-- Abandoned checkout case (Diana Prince)
('33333333-3333-3333-3333-333333333304', '00000000-0000-0000-0000-000000000004', NULL, NULL, 'pay_checkout_diana_abandoned', 'order_diana_001', 2500.00, 'INR', 'failed_checkout', 'unknown', 'diana.prince@example.com', '+919876543213', 'checkout_abandoned', 'Customer closed checkout without attempting payment', 'customer', 'payment_authentication', 'abandoned_checkout', TRUE),

-- Failed payment (Recovered - Evan Wright - Temporary Bank Outage)
('33333333-3333-3333-3333-333333333305', '00000000-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111115', '22222222-2222-2222-2222-222222222215', 'pay_failed_evan_outage', 'order_evan_001', 4500.00, 'INR', 'failed', 'card', 'evan.wright@example.com', '+919876543214', 'gateway_error', 'Internal gateway communication failure', 'gateway', 'payment_processing', 'gateway_error', TRUE);

-- 5. Insert Recovery Cases (Prefix: 44444444)
INSERT INTO recovery_cases (id, payment_id, customer_id, status, recovery_probability, revenue_at_risk, recovered_amount, strategy, stopping_rule_triggered, escalated_to_human, escalated_at) VALUES
-- Bob Smith (Active Recovery)
('44444444-4444-4444-4444-444444444402', '33333333-3333-3333-3333-333333333302', '00000000-0000-0000-0000-000000000002', 'in_recovery', 0.85, 12500.00, 0.00, 'payment_link', NULL, FALSE, NULL),

-- Charlie Brown (Unrecoverable / Stopped)
('44444444-4444-4444-4444-444444444403', '33333333-3333-3333-3333-333333333303', '00000000-0000-0000-0000-000000000003', 'failed', 0.15, 500.00, 0.00, 'reminder_email', 'max_attempts', FALSE, NULL),

-- Evan Wright (Recovered Case)
('44444444-4444-4444-4444-444444444405', '33333333-3333-3333-3333-333333333305', '00000000-0000-0000-0000-000000000005', 'recovered', 0.75, 4500.00, 4500.00, 'retry', NULL, FALSE, NULL);

-- 6. Insert Recovery Attempts (Prefix: 55555555)
INSERT INTO recovery_attempts (id, case_id, payment_id, strategy, status, recovery_probability, predicted_amount, actual_amount, diagnosis, shap_explanation, safety_check_passed, guardrail_notes, attempt_number, max_attempts, executed_at, completed_at, is_demo) VALUES
-- Bob's active case (1 attempt made, currently in progress)
('55555555-5555-5555-5555-555555555502', '44444444-4444-4444-4444-444444444402', '33333333-3333-3333-3333-333333333302', 'payment_link', 'in_progress', 0.85, 12500.00, 0.00, 'Customer has sufficient active profile but card failed due to limit/funds. Payment link sent.', '{"customer_tenure_months": 12, "failed_payment_count": 0}', TRUE, 'No safety flags. Clean record.', 1, 3, NOW() - INTERVAL '1 day', NULL, TRUE),

-- Charlie's failed case (3 attempts made, all failed)
('55555555-5555-5555-5555-555555555531', '44444444-4444-4444-4444-444444444403', '33333333-3333-3333-3333-333333333303', 'retry', 'failed', 0.25, 500.00, 0.00, 'Immediate system retry.', '{}', TRUE, 'No safety flags.', 1, 3, NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days', TRUE),
('55555555-5555-5555-5555-555555555532', '44444444-4444-4444-4444-444444444403', '33333333-3333-3333-3333-333333333303', 'reminder_email', 'failed', 0.20, 500.00, 0.00, 'Reminder email sent to update payment details.', '{}', TRUE, 'No safety flags.', 2, 3, NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days', TRUE),
('55555555-5555-5555-5555-555555555533', '44444444-4444-4444-4444-444444444403', '33333333-3333-3333-3333-333333333303', 'alternate_method', 'failed', 0.10, 500.00, 0.00, 'Alternate UPI/card payment option page sent.', '{}', TRUE, 'No safety flags.', 3, 3, NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day', TRUE),

-- Evan's recovered case (1 attempt made, succeeded)
('55555555-5555-5555-5555-555555555555', '44444444-4444-4444-4444-444444444405', '33333333-3333-3333-3333-333333333305', 'retry', 'success', 0.75, 4500.00, 4500.00, 'Automated system retry for gateway communication failure.', '{"error_source_gateway": 1}', TRUE, 'No safety flags. Temporary failure retry.', 1, 3, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour 50 minutes', TRUE);

-- 7. Insert AI Predictions (Prefix: 66666666)
INSERT INTO ai_predictions (id, payment_id, model_version, failure_reason_prediction, recovery_probability, revenue_at_risk, suggested_strategy, features_used, shap_values) VALUES
('66666666-6666-6666-6666-666666666602', '33333333-3333-3333-3333-333333333302', 'v1.0.0', 'insufficient_funds', 0.85, 12500.00, 'payment_link', '{"card_type": "visa", "historical_failures": 0}', '{"card_type": 0.15, "historical_failures": 0.25}'),
('66666666-6666-6666-6666-666666666603', '33333333-3333-3333-3333-333333333303', 'v1.0.0', 'authentication_failed', 0.15, 500.00, 'reminder_email', '{"payment_method": "upi", "historical_failures": 2}', '{"payment_method": -0.10, "historical_failures": -0.30}'),
('66666666-6666-6666-6666-666666666605', '33333333-3333-3333-3333-333333333305', 'v1.0.0', 'gateway_error', 0.75, 4500.00, 'retry', '{"error_source": "gateway"}', '{"error_source": 0.35}');

-- 8. Insert AI Decisions (Prefix: 77777777)
INSERT INTO ai_decisions (id, case_id, attempt_id, action_type, rationale, confidence_score, safety_check_status) VALUES
('77777777-7777-7777-7777-777777777702', '44444444-4444-4444-4444-444444444402', '55555555-5555-5555-5555-555555555502', 'send_payment_link', 'Bank declined due to insufficient funds; customer has active history. Sending SMS/Email payment link is highly recommended.', 0.90, 'passed'),
('77777777-7777-7777-7777-777777777703', '44444444-4444-4444-4444-444444444403', '55555555-5555-5555-5555-555555555533', 'stop_recovery', 'Max recovery attempts reached (3/3). Stopping further actions.', 0.95, 'passed'),
('77777777-7777-7777-7777-777777777705', '44444444-4444-4444-4444-444444444405', '55555555-5555-5555-5555-555555555555', 'trigger_retry', 'Temporary gateway error detected. System retry is safe and has high success rate.', 0.80, 'passed');

-- 9. Insert Notifications (Prefix: 88888888)
INSERT INTO notifications (id, customer_id, case_id, type, recipient, subject, body, status, sent_at) VALUES
('88888888-8888-8888-8888-888888888801', '00000000-0000-0000-0000-000000000002', '44444444-4444-4444-4444-444444444402', 'email', 'bob.smith@example.com', 'Action Required: Update payment method', 'Hi Bob, your payment of 12,500 INR failed. Click here to pay: https://pay.razorpay.com/pl_bob001', 'sent', NOW() - INTERVAL '1 day'),
('88888888-8888-8888-8888-888888888802', '00000000-0000-0000-0000-000000000002', '44444444-4444-4444-4444-444444444402', 'sms', '+919876543211', NULL, 'RazorRecover: Your payment of 12500 INR failed. Pay now: https://pay.razorpay.com/pl_bob001', 'delivered', NOW() - INTERVAL '23 hours'),
('88888888-8888-8888-8888-888888888803', '00000000-0000-0000-0000-000000000003', '44444444-4444-4444-4444-444444444403', 'email', 'charlie.brown@example.com', 'Subscription Payment Overdue', 'Hi Charlie, your payment of 500 INR is overdue. Please log in to update card info.', 'sent', NOW() - INTERVAL '3 days');

-- 10. Insert Audit Logs
INSERT INTO audit_logs (id, event_type, entity_type, entity_id, actor, details, severity) VALUES
(gen_random_uuid(), 'payment_failed', 'payment', '33333333-3333-3333-3333-333333333302', 'system', '{"amount": 12500.00, "error_reason": "insufficient_funds"}', 'warning'),
(gen_random_uuid(), 'recovery_initiated', 'recovery_case', '44444444-4444-4444-4444-444444444402', 'ai_agent', '{"strategy": "payment_link", "probability": 0.85}', 'info'),
(gen_random_uuid(), 'payment_failed', 'payment', '33333333-3333-3333-3333-333333333303', 'system', '{"amount": 500.00, "error_reason": "authentication_failed"}', 'warning'),
(gen_random_uuid(), 'payment_failed', 'payment', '33333333-3333-3333-3333-333333333305', 'system', '{"amount": 4500.00, "error_reason": "gateway_error"}', 'warning'),
(gen_random_uuid(), 'recovery_initiated', 'recovery_case', '44444444-4444-4444-4444-444444444405', 'ai_agent', '{"strategy": "retry", "probability": 0.75}', 'info'),
(gen_random_uuid(), 'recovery_completed', 'recovery_case', '44444444-4444-4444-4444-444444444405', 'system', '{"amount_recovered": 4500.00, "strategy": "retry"}', 'info');
