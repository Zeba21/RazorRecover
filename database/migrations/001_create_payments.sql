-- Migration 001: Create billing tables (customers, subscriptions, invoices, payments)

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Customers Table
CREATE TABLE IF NOT EXISTS customers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  email       TEXT UNIQUE NOT NULL,
  phone       TEXT,
  notes       JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Subscriptions Table
CREATE TABLE IF NOT EXISTS subscriptions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id           UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  status                TEXT NOT NULL CHECK (status IN ('active', 'trialing', 'past_due', 'canceled', 'unpaid', 'paused')),
  plan_name             TEXT NOT NULL,
  plan_amount           NUMERIC(15, 2) NOT NULL, -- Monetary field using NUMERIC
  currency              TEXT NOT NULL DEFAULT 'INR',
  current_period_start  TIMESTAMPTZ NOT NULL,
  current_period_end    TIMESTAMPTZ NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Invoices Table
CREATE TABLE IF NOT EXISTS invoices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id     UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  amount          NUMERIC(15, 2) NOT NULL, -- Monetary field using NUMERIC
  currency        TEXT NOT NULL DEFAULT 'INR',
  status          TEXT NOT NULL CHECK (status IN ('draft', 'open', 'paid', 'uncollectible', 'void', 'overdue')),
  due_date        TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Payments Table
CREATE TABLE IF NOT EXISTS payments (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id           UUID REFERENCES customers(id) ON DELETE SET NULL,
  subscription_id       UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  invoice_id            UUID REFERENCES invoices(id) ON DELETE SET NULL,
  razorpay_payment_id   TEXT UNIQUE,
  razorpay_order_id     TEXT,
  amount                NUMERIC(15, 2) NOT NULL, -- Monetary field using NUMERIC
  currency              TEXT DEFAULT 'INR',
  status                TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'authorized', 'captured', 'failed', 'refunded', 'failed_checkout')),
  method                TEXT CHECK (method IN ('card', 'upi', 'netbanking', 'wallet', 'unknown')),
  email                 TEXT,
  contact               TEXT,
  error_code            TEXT,                             -- Razorpay error code
  error_description     TEXT,                             -- Human-readable error message
  error_source          TEXT CHECK (error_source IN ('customer', 'business', 'gateway', 'razorpay', 'system')),
  error_step            TEXT,                             -- payment_authentication | payment_processing
  error_reason          TEXT,                             -- insufficient_funds | authentication_failed etc.
  notes                 JSONB DEFAULT '{}',
  is_demo               BOOLEAN DEFAULT TRUE,             -- Distinguish demo from real payments
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for billing tables
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_subscriptions_customer ON subscriptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_payments_customer ON payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at);
