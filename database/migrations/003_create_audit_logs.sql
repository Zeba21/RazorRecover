-- Migration 003: Create auxiliary tables (audit_logs, notifications)

-- 9. Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type      TEXT NOT NULL,                -- payment_failed | recovery_initiated | recovery_completed | system_error | human_override
  entity_type     TEXT,                          -- payment | recovery_attempt | recovery_case
  entity_id       UUID,                          -- References the related entity
  actor           TEXT DEFAULT 'system' CHECK (actor IN ('system', 'ai_agent', 'user', 'customer')),
  details         JSONB DEFAULT '{}',            -- Arbitrary event metadata
  severity        TEXT DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id     UUID REFERENCES customers(id) ON DELETE CASCADE,
  case_id         UUID REFERENCES recovery_cases(id) ON DELETE CASCADE,
  type            TEXT NOT NULL CHECK (type IN ('email', 'sms', 'whatsapp', 'slack_alert')),
  recipient       TEXT NOT NULL,
  subject         TEXT,
  body            TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed')),
  error_message   TEXT,
  sent_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for auxiliary tables
CREATE INDEX IF NOT EXISTS idx_audit_event_type ON audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_notifications_customer ON notifications(customer_id);
CREATE INDEX IF NOT EXISTS idx_notifications_case ON notifications(case_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);
