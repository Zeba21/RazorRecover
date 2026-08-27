-- Migration 004: Create revenue_events table for event ingestion

CREATE TABLE IF NOT EXISTS revenue_events (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type          TEXT NOT NULL CHECK (event_type IN ('PAYMENT_FAILED', 'PAYMENT_SUCCESS', 'CHECKOUT_ABANDONED', 'SUBSCRIPTION_FAILED', 'INVOICE_OVERDUE')),
  customer_id         UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  payment_reference   TEXT,
  invoice_reference   TEXT,
  amount              NUMERIC(15, 2) NOT NULL,
  timestamp           TIMESTAMPTZ NOT NULL,
  metadata            JSONB DEFAULT '{}',
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance and quick retrieval
CREATE INDEX IF NOT EXISTS idx_revenue_events_customer ON revenue_events(customer_id);
CREATE INDEX IF NOT EXISTS idx_revenue_events_event_type ON revenue_events(event_type);
CREATE INDEX IF NOT EXISTS idx_revenue_events_timestamp ON revenue_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_revenue_events_payment_ref ON revenue_events(payment_reference);
