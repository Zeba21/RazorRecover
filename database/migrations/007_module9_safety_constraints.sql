-- Migration 007: Module 9 Safety Constraints & Performance Indexes

-- 1. Check constraints on monetary fields to prevent negative values
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_payments_amount_non_negative'
  ) THEN
    ALTER TABLE payments ADD CONSTRAINT chk_payments_amount_non_negative CHECK (amount >= 0.00);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_recovery_cases_revenue_non_negative'
  ) THEN
    ALTER TABLE recovery_cases ADD CONSTRAINT chk_recovery_cases_revenue_non_negative CHECK (revenue_at_risk >= 0.00 AND recovered_amount >= 0.00);
  END IF;
END $$;

-- 2. Indexes for Audit Logs and Recovery Attempts searching/filtering
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor);
CREATE INDEX IF NOT EXISTS idx_audit_entity_id ON audit_logs(entity_id);
CREATE INDEX IF NOT EXISTS idx_recovery_attempts_created ON recovery_attempts(created_at);
CREATE INDEX IF NOT EXISTS idx_recovery_cases_escalated ON recovery_cases(escalated_to_human);

-- 3. Idempotency Key Partial Unique Index on Recovery Attempts if idempotency_key is present
CREATE UNIQUE INDEX IF NOT EXISTS idx_recovery_attempts_unique_idempotency 
ON recovery_attempts(idempotency_key) 
WHERE idempotency_key IS NOT NULL;
