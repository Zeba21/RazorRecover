-- Migration 003: Create audit_logs table
-- Records every significant action for observability and compliance

CREATE TABLE IF NOT EXISTS audit_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type      TEXT NOT NULL,                -- payment_failed | recovery_initiated | recovery_completed | system_error
  entity_type     TEXT,                          -- payment | recovery_attempt
  entity_id       UUID,                          -- References the related payment or recovery_attempt
  actor           TEXT DEFAULT 'system',          -- system | ai_agent | user
  details         JSONB DEFAULT '{}',            -- Arbitrary event metadata
  severity        TEXT DEFAULT 'info',            -- info | warning | error | critical
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Index on event_type for filtering
CREATE INDEX IF NOT EXISTS idx_audit_event_type ON audit_logs(event_type);

-- Index on created_at for time-range queries
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_logs(created_at);

-- Index on entity lookup
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);
