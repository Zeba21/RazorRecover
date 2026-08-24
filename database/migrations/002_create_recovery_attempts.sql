-- Migration 002: Create recovery_attempts table
-- Tracks each AI-driven recovery attempt for a failed payment

CREATE TABLE IF NOT EXISTS recovery_attempts (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id              UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  strategy                TEXT NOT NULL,                -- retry | payment_link | reminder_email | alternate_method
  status                  TEXT DEFAULT 'pending',       -- pending | in_progress | success | failed | skipped
  recovery_probability    FLOAT,                        -- ML-predicted probability (0.0 - 1.0)
  predicted_amount        INTEGER,                      -- Predicted recoverable amount (paise)
  actual_amount           INTEGER,                      -- Actually recovered amount (paise)
  diagnosis               TEXT,                         -- AI-diagnosed failure cause
  shap_explanation        JSONB,                        -- SHAP feature importance values
  safety_check_passed     BOOLEAN DEFAULT FALSE,
  guardrail_notes         TEXT,                         -- Why safety check passed/failed
  attempt_number          INTEGER DEFAULT 1,
  max_attempts            INTEGER DEFAULT 3,
  executed_at             TIMESTAMPTZ,
  completed_at            TIMESTAMPTZ,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  is_demo                 BOOLEAN DEFAULT TRUE          -- Distinguish demo from real actions
);

-- Index for looking up attempts by payment
CREATE INDEX IF NOT EXISTS idx_recovery_payment_id ON recovery_attempts(payment_id);

-- Index for filtering by status
CREATE INDEX IF NOT EXISTS idx_recovery_status ON recovery_attempts(status);
