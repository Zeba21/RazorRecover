-- Migration 001: Create payments table
-- Stores all payment records (both from Razorpay and demo/synthetic data)

CREATE TABLE IF NOT EXISTS payments (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  razorpay_payment_id   TEXT UNIQUE,
  razorpay_order_id     TEXT,
  amount                INTEGER NOT NULL,                -- Amount in paise (₹12,500 = 1250000)
  currency              TEXT DEFAULT 'INR',
  status                TEXT NOT NULL DEFAULT 'created',  -- created | authorized | captured | failed | refunded
  method                TEXT,                             -- card | upi | netbanking | wallet
  email                 TEXT,
  contact               TEXT,
  error_code            TEXT,                             -- Razorpay error code
  error_description     TEXT,                             -- Human-readable error message
  error_source          TEXT,                             -- customer | business | gateway | razorpay
  error_step            TEXT,                             -- payment_authentication | payment_processing
  error_reason          TEXT,                             -- insufficient_funds | authentication_failed etc.
  notes                 JSONB DEFAULT '{}',
  is_demo               BOOLEAN DEFAULT TRUE,            -- Distinguish demo from real payments
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- Index on status for fast filtering of failed payments
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

-- Index on created_at for time-range queries
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at);
