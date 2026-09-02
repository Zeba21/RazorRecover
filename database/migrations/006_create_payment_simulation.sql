-- Migration 006: Add payment simulation, provider, and idempotency fields

ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'mock';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS transaction_reference TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

ALTER TABLE recovery_attempts ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'mock';
ALTER TABLE recovery_attempts ADD COLUMN IF NOT EXISTS transaction_reference TEXT;
ALTER TABLE recovery_attempts ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
ALTER TABLE recovery_attempts ADD COLUMN IF NOT EXISTS action TEXT;

CREATE INDEX IF NOT EXISTS idx_payments_idempotency ON payments(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_recovery_attempts_idempotency ON recovery_attempts(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_recovery_attempts_tx_ref ON recovery_attempts(transaction_reference);
