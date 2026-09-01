-- Migration 005: Create recovery explanations table for Module 5 (SHAP Explainability)

CREATE TABLE IF NOT EXISTS recovery_explanations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id            UUID REFERENCES payments(id) ON DELETE SET NULL,
  transaction_amount    NUMERIC(15, 2) NOT NULL,
  recovery_probability NUMERIC(5, 4) NOT NULL CHECK (recovery_probability >= 0.0000 AND recovery_probability <= 1.0000),
  risk_level            TEXT NOT NULL CHECK (risk_level IN ('HIGH', 'MEDIUM', 'LOW')),
  model_version         TEXT NOT NULL DEFAULT 'recovery-xgboost-v1.0',
  top_positive_factors  JSONB DEFAULT '[]',
  top_negative_factors  JSONB DEFAULT '[]',
  feature_importance    JSONB DEFAULT '[]',
  human_explanation     TEXT NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for recovery explanations
CREATE INDEX IF NOT EXISTS idx_recovery_explanations_payment ON recovery_explanations(payment_id);
CREATE INDEX IF NOT EXISTS idx_recovery_explanations_created_at ON recovery_explanations(created_at);
