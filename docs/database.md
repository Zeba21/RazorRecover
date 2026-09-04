# RazorRecover Database Architecture & Schema

## 1. Overview

RazorRecover uses **Supabase PostgreSQL** as its single, persistent data layer. The database schema consists of 12 core tables designed to track billing entities, revenue events, recovery cases, AI predictions, SHAP attributions, execution attempts, safety audit trails, and customer notifications.

---

## 2. Schema ER Diagram

```
customers ─────────────► subscriptions ─────────────► invoices ─────────────► payments
   │                                                                             │
   ▼                                                                             ▼
notifications                                                             revenue_events
                                                                                 │
                                                                                 ▼
recovery_attempts ◄───── recovery_cases ◄───── ai_predictions ◄───── recovery_explanations
        │                     │
        ▼                     ▼
   audit_logs ◄───────── ai_decisions
```

---

## 3. Table Definitions

### 3.1 `customers`
Stores customer profile records, contact info, notes, and subscription tiers.
- `id` (UUID, Primary Key)
- `name` (TEXT, Not Null)
- `email` (TEXT, Unique, Not Null)
- `phone` (TEXT)
- `notes` (JSONB)
- `created_at` (TIMESTAMPTZ)

### 3.2 `subscriptions`
Stores recurring subscription plans and statuses.
- `id` (UUID, Primary Key)
- `customer_id` (UUID, FK -> `customers.id`)
- `status` (TEXT: `active`, `past_due`, `canceled`, `trialing`, `paused`, `unpaid`)
- `plan_name` (TEXT)
- `plan_amount` (NUMERIC)
- `currency` (TEXT, Default `'INR'`)
- `current_period_start` (TIMESTAMPTZ)
- `current_period_end` (TIMESTAMPTZ)
- `created_at` (TIMESTAMPTZ)

### 3.3 `invoices`
Stores billing invoices tied to subscriptions.
- `id` (UUID, Primary Key)
- `customer_id` (UUID, FK -> `customers.id`)
- `subscription_id` (UUID, FK -> `subscriptions.id`)
- `amount` (NUMERIC, Not Null)
- `currency` (TEXT, Default `'INR'`)
- `status` (TEXT: `draft`, `open`, `paid`, `overdue`, `uncollectible`, `void`)
- `due_date` (TIMESTAMPTZ)
- `created_at` (TIMESTAMPTZ)

### 3.4 `payments`
Stores historical payment attempts and gateway transactions.
- `id` (UUID, Primary Key)
- `customer_id` (UUID, FK -> `customers.id`)
- `subscription_id` (UUID, FK -> `subscriptions.id`)
- `invoice_id` (UUID, FK -> `invoices.id`)
- `razorpay_payment_id` (TEXT, Unique)
- `razorpay_order_id` (TEXT)
- `amount` (NUMERIC, Check `>= 0`)
- `currency` (TEXT, Default `'INR'`)
- `status` (TEXT: `created`, `authorized`, `captured`, `refunded`, `failed`)
- `method` (TEXT: `card`, `upi`, `netbanking`, `wallet`)
- `email` (TEXT)
- `contact` (TEXT)
- `error_code` (TEXT)
- `error_description` (TEXT)
- `error_source` (TEXT)
- `error_step` (TEXT)
- `error_reason` (TEXT)
- `is_demo` (BOOLEAN, Default `false`)
- `created_at` (TIMESTAMPTZ)

### 3.5 `revenue_events`
Stores real-time billing events ingested by the Revenue Event Engine.
- `id` (UUID, Primary Key)
- `event_type` (TEXT: `PAYMENT_FAILED`, `PAYMENT_SUCCESS`, `CHECKOUT_ABANDONED`, `SUBSCRIPTION_FAILED`, `INVOICE_OVERDUE`)
- `customer_id` (UUID, FK -> `customers.id`)
- `payment_reference` (TEXT, Unique)
- `amount` (NUMERIC)
- `revenue_at_risk` (NUMERIC)
- `status` (TEXT: `pending`, `processed`, `failed`)
- `metadata` (JSONB)
- `created_at` (TIMESTAMPTZ)

### 3.6 `recovery_cases`
Tracks active recovery cases created from revenue events.
- `id` (UUID, Primary Key)
- `event_id` (UUID, FK -> `revenue_events.id`)
- `customer_id` (UUID, FK -> `customers.id`)
- `status` (TEXT: `open`, `in_recovery`, `recovered`, `failed`, `escalated_to_human`, `closed`)
- `revenue_at_risk` (NUMERIC, Check `>= 0`)
- `recovered_amount` (NUMERIC, Check `>= 0`, Default `0.00`)
- `risk_level` (TEXT: `LOW`, `MEDIUM`, `HIGH`)
- `recovery_probability` (NUMERIC)
- `assigned_agent` (TEXT)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

### 3.7 `recovery_attempts`
Logs every execution attempt made for a recovery case.
- `id` (UUID, Primary Key)
- `case_id` (UUID, FK -> `recovery_cases.id`)
- `attempt_number` (INTEGER)
- `action_taken` (TEXT)
- `idempotency_key` (TEXT, Unique Partial Index)
- `provider` (TEXT, Default `'MockPaymentProvider'`)
- `provider_reference` (TEXT)
- `outcome` (TEXT: `SUCCESS`, `FAILED`, `PENDING`, `CANCELLED`, `GUARDRAIL_BLOCKED`)
- `error_message` (TEXT)
- `created_at` (TIMESTAMPTZ)

### 3.8 `ai_predictions`
Stores ML model outputs per prediction request.
- `id` (UUID, Primary Key)
- `case_id` (UUID, FK -> `recovery_cases.id`)
- `model_version` (TEXT)
- `recovery_probability` (NUMERIC)
- `risk_level` (TEXT)
- `features_used` (JSONB)
- `created_at` (TIMESTAMPTZ)

### 3.9 `ai_decisions`
Stores LangGraph workflow decisions and LLM responses.
- `id` (UUID, Primary Key)
- `case_id` (UUID, FK -> `recovery_cases.id`)
- `recommended_action` (TEXT)
- `root_cause_diagnosis` (TEXT)
- `reasoning` (TEXT)
- `guardrail_status` (TEXT)
- `created_at` (TIMESTAMPTZ)

### 3.10 `recovery_explanations`
Stores SHAP feature attribution data for model explainability.
- `id` (UUID, Primary Key)
- `prediction_id` (UUID, FK -> `ai_predictions.id`)
- `case_id` (UUID, FK -> `recovery_cases.id`)
- `positive_factors` (JSONB)
- `negative_factors` (JSONB)
- `explanation_narrative` (TEXT)
- `created_at` (TIMESTAMPTZ)

### 3.11 `audit_logs`
Immutable audit log tracking all security and execution events.
- `id` (UUID, Primary Key)
- `actor` (TEXT: `AI_AGENT`, `GUARDRAIL`, `SYSTEM`, `USER`)
- `entity_type` (TEXT)
- `entity_id` (UUID)
- `action` (TEXT)
- `reason` (TEXT)
- `guardrail_result` (TEXT)
- `execution_result` (TEXT)
- `amount` (NUMERIC)
- `metadata` (JSONB)
- `created_at` (TIMESTAMPTZ)

### 3.12 `notifications`
Communication logs sent to customers.
- `id` (UUID, Primary Key)
- `customer_id` (UUID, FK -> `customers.id`)
- `case_id` (UUID, FK -> `recovery_cases.id`)
- `channel` (TEXT: `email`, `sms`, `whatsapp`)
- `template_name` (TEXT)
- `status` (TEXT: `sent`, `delivered`, `failed`)
- `created_at` (TIMESTAMPTZ)

---

## 4. Migrations & Order of Execution

All SQL migrations are stored in `database/migrations/` and must be executed sequentially:

1. `001_create_payments.sql`: Creates core entities (`customers`, `subscriptions`, `invoices`, `payments`, `recovery_cases`).
2. `002_create_recovery_attempts.sql`: Creates `recovery_attempts`, `ai_predictions`, `ai_decisions`, `notifications`.
3. `003_create_audit_logs.sql`: Creates `audit_logs` and indexes.
4. `004_create_revenue_events.sql`: Creates `revenue_events` and connects foreign keys.
5. `005_create_recovery_explanations.sql`: Creates `recovery_explanations` for SHAP storage.
6. `006_create_payment_simulation.sql`: Adds simulation flags and provider tracking fields.
7. `007_module9_safety_constraints.sql`: Adds non-negative check constraints on amounts and unique partial indexes on idempotency keys.

---

## 5. Runtime Persistence Behavior

All state changes during execution are written to PostgreSQL via Supabase APIs:
- Revenue event ingestion creates rows in `revenue_events` and `recovery_cases`.
- ML predictions & SHAP explanations write to `ai_predictions` and `recovery_explanations`.
- Payment retries write to `recovery_attempts` and append to `audit_logs`.
- Successful payment retries update `recovery_cases.status` to `'recovered'`, update `recovered_amount` to the event amount, and mark corresponding `invoices` as `'paid'`.

Zero manual database editing is required for runtime execution or demo flows.
