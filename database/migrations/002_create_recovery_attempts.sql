-- Migration 002: Create recovery orchestration tables (recovery_cases, recovery_attempts, ai_predictions, ai_decisions)

-- 5. Recovery Cases Table
CREATE TABLE IF NOT EXISTS recovery_cases (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id                UUID NOT NULL UNIQUE REFERENCES payments(id) ON DELETE CASCADE,
  customer_id               UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  status                    TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_recovery', 'recovered', 'failed', 'escalated', 'closed')),
  recovery_probability      NUMERIC(5, 2) CHECK (recovery_probability >= 0.00 AND recovery_probability <= 1.00), -- probability 0.00 to 1.00
  revenue_at_risk           NUMERIC(15, 2) NOT NULL,
  recovered_amount          NUMERIC(15, 2) DEFAULT 0.00,
  strategy                  TEXT,
  stopping_rule_triggered   TEXT,
  escalated_to_human        BOOLEAN DEFAULT FALSE,
  escalated_at              TIMESTAMPTZ,
  created_at                TIMESTAMPTZ DEFAULT NOW(),
  updated_at                TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Recovery Attempts Table
CREATE TABLE IF NOT EXISTS recovery_attempts (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id                 UUID NOT NULL REFERENCES recovery_cases(id) ON DELETE CASCADE,
  payment_id              UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  strategy                TEXT NOT NULL CHECK (strategy IN ('retry', 'payment_link', 'reminder_email', 'alternate_method')),
  status                  TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'success', 'failed', 'skipped')),
  recovery_probability    NUMERIC(5, 2) CHECK (recovery_probability >= 0.00 AND recovery_probability <= 1.00),
  predicted_amount        NUMERIC(15, 2),
  actual_amount           NUMERIC(15, 2),
  diagnosis               TEXT,
  shap_explanation        JSONB,
  safety_check_passed     BOOLEAN DEFAULT FALSE,
  guardrail_notes         TEXT,
  attempt_number          INTEGER DEFAULT 1,
  max_attempts            INTEGER DEFAULT 3,
  executed_at             TIMESTAMPTZ,
  completed_at            TIMESTAMPTZ,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  is_demo                 BOOLEAN DEFAULT TRUE
);

-- 7. AI Predictions Table
CREATE TABLE IF NOT EXISTS ai_predictions (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id                UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  model_version             TEXT NOT NULL,
  failure_reason_prediction  TEXT,
  recovery_probability      NUMERIC(5, 2) NOT NULL CHECK (recovery_probability >= 0.00 AND recovery_probability <= 1.00),
  revenue_at_risk           NUMERIC(15, 2) NOT NULL,
  suggested_strategy        TEXT NOT NULL,
  features_used             JSONB DEFAULT '{}',
  shap_values               JSONB DEFAULT '{}',
  created_at                TIMESTAMPTZ DEFAULT NOW()
);

-- 8. AI Decisions Table
CREATE TABLE IF NOT EXISTS ai_decisions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id             UUID NOT NULL REFERENCES recovery_cases(id) ON DELETE CASCADE,
  attempt_id          UUID REFERENCES recovery_attempts(id) ON DELETE SET NULL,
  action_type         TEXT NOT NULL CHECK (action_type IN ('trigger_retry', 'send_payment_link', 'send_email', 'escalate_human', 'stop_recovery')),
  rationale           TEXT NOT NULL,
  confidence_score    NUMERIC(5, 2) NOT NULL CHECK (confidence_score >= 0.00 AND confidence_score <= 1.00),
  safety_check_status TEXT NOT NULL CHECK (safety_check_status IN ('passed', 'flagged', 'blocked')),
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for recovery tables
CREATE INDEX IF NOT EXISTS idx_recovery_cases_payment ON recovery_cases(payment_id);
CREATE INDEX IF NOT EXISTS idx_recovery_cases_customer ON recovery_cases(customer_id);
CREATE INDEX IF NOT EXISTS idx_recovery_cases_status ON recovery_cases(status);
CREATE INDEX IF NOT EXISTS idx_recovery_attempts_case ON recovery_attempts(case_id);
CREATE INDEX IF NOT EXISTS idx_recovery_attempts_payment ON recovery_attempts(payment_id);
CREATE INDEX IF NOT EXISTS idx_recovery_attempts_status ON recovery_attempts(status);
CREATE INDEX IF NOT EXISTS idx_ai_predictions_payment ON ai_predictions(payment_id);
CREATE INDEX IF NOT EXISTS idx_ai_decisions_case ON ai_decisions(case_id);
