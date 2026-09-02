# RazorRecover — Project Status & Module Map

## Overview
RazorRecover is an AI-powered automated revenue recovery system for failed SaaS recurring payments.

---

## Module Status Dashboard

| Module | Name | Status | Key Features / Technologies |
| :--- | :--- | :--- | :--- |
| **Module 0** | Core Architecture & Setup | ✅ COMPLETE | Express, Supabase PostgreSQL, Config, Environment Validation |
| **Module 1** | Billing Data Models & Ingestion | ✅ COMPLETE | Subscriptions, Invoices, Customers, Payments SQL Schema & APIs |
| **Module 2** | Mock Payment Failure Generator | ✅ COMPLETE | Synthetic Event & Webhook Generator for Failed Payments |
| **Module 3** | Revenue Event Engine | ✅ COMPLETE | Real-time Ingestion, Idempotent Processing, Revenue-at-Risk Engine |
| **Module 4** | ML Payment Recovery Prediction | ✅ COMPLETE | XGBoost Classifier, 13-feature Preprocessing Pipeline, FastAPI |
| **Module 5** | Model Explainability (SHAP) | ✅ COMPLETE | SHAP Feature Attribution, Human Narratives, Fast In-memory Inference |
| **Module 6** | LangGraph AI Recovery Agent | ✅ COMPLETE | 12-State LangGraph Workflow, Gemini LLM Diagnosis, Policy Guardrails |
| **Module 7** | Payment Simulation & Provider Layer | ✅ COMPLETE | `PaymentProvider` Abstraction, `MockPaymentProvider`, Single-Source Node Payment Execution Service, Webhooks, Idempotency, Zero Credentials Required |
| **Module 8** | Dashboard & UI Integration | ✅ COMPLETE | Premium Fintech React + TS Dashboard, Live Supabase Metrics, Recharts Area Chart, Filterable Cases, Case Details, AI Activity Panel, Hero Demo Flow |

---

## Module 8 Details — Winning Dashboard Integration

- **Strict Zero-Hardcoding Rule**: All KPIs (Revenue at Risk, Revenue Recovered, Recovery Rate %, Active Cases), charts, cases, predictions, SHAP explainability, root causes, guardrail decisions, attempts, and activity events are calculated dynamically from Supabase database tables via backend APIs.
- **Backend Aggregate APIs**:
  - `GET /api/dashboard/summary`: Computes aggregate financial metrics and case counts.
  - `GET /api/dashboard/revenue`: Computes time-series revenue at risk vs recovered.
  - `GET /api/dashboard/cases`: Returns enriched cases with search and status/risk filters.
  - `GET /api/recovery/:caseId/detail`: Serves full case details, payment metadata (stripping sensitive credentials), XGBoost probability, SHAP factors, guardrail decisions, attempts, and audit timeline.
  - `GET /api/recovery/activity`: Live audit stream for AI agent activity panel.
- **Dedicated Routing**: Dedicated case detail view at `/dashboard/cases/:caseId`.
- **Run Recovery Demo Hero Button**: Executes the Module 7 recovery workflow end-to-end (event generation -> XGBoost prediction -> SHAP -> LLM diagnosis -> guardrail validation -> MockPaymentProvider execution -> DB updates), displaying live progress and auto-refreshing the dashboard upon completion.


## Module 7 Details — Payment Simulation & Provider Abstraction

- **Authoritative Payment Execution Layer**: `backend/src/services/paymentService.js` (Node.js/Express) is the sole single source of truth for payment execution, idempotency verification, database updates (`payments`, `recovery_cases`, `recovery_attempts`, `audit_logs`), and webhook ingestion.
- **Provider Abstraction**:
  - `PaymentProvider`: Abstract base class for payment execution interface.
  - `MockPaymentProvider`: Active provider producing deterministic simulated results (`SUCCESS`, `FAILED`, `PENDING`, `CANCELLED`) with reference IDs (`MOCK_PAY_XXXXXXXX`).
  - `RazorpayProvider`: Inactive optional future placeholder. Requires zero API credentials (`RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET`).
- **₹12,500 Repeatable Demo Case**: Uses actual trained Module 4 XGBoost probability output, SHAP explanation, LLM diagnosis, guardrail approval, and mock execution to recover ₹12,500.
- **Guardrails Enforced**:
  - Max retries (3) limit → Escalate to Human
  - High-value transaction threshold (≥ ₹50,000) → Flag for Human Approval
  - Customer Opt-out → Stop recovery
  - Already Recovered / Captured Payment → Stop recovery
  - Invalid Action → Reject
- **Mock Webhooks**: `POST /api/webhooks/mock-payment` handles `payment.success`, `payment.failed`, `payment.pending`, `payment.cancelled` with strict idempotency key validation.
