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
| **Module 9** | Safety, Audit & Evaluation | ✅ COMPLETE | Complete Audit Trail, Guardrail Logging, Rate Limiting, Input Validation, Audit Explorer Page, Recovery Analytics Page, Model Evaluation Page, 16-Test Security & Functional Test Suite |

---

## Module 9 Details — Safety, Audit & Evaluation

- **Safety Hardening & Database Migration**:
  - `007_module9_safety_constraints.sql` applied non-negative check constraints on payments `amount` and recovery cases `revenue_at_risk`/`recovered_amount`, performance indexes on `audit_logs(actor, entity_id, created_at)` and unique partial index on `recovery_attempts(idempotency_key)`.
  - Rate limiting middleware (`rateLimiter.js`) applied to `/api/recovery/:caseId/execute`, `/api/demo/payment-failure`, and `/api/webhooks/mock-payment`.
  - Input validation: UUID format validation (`/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/`), enum validation, non-negative amounts, query/body parameter sanitization.
  - Safe error handling: `errorHandler.js` suppresses stack traces and internal secrets in HTTP responses.
- **Audit Explorer Page (`/dashboard/audit`)**:
  - Full Audit Explorer showing timestamp, case ID, action, reason, AI recommendation, guardrail result, execution result, amount, actor, and system version.
  - Real database records fetched via `GET /api/audit` with search, action filter, guardrail filter, and pagination.
- **Recovery Analytics Page (`/dashboard/analytics`)**:
  - Real database-derived business metrics fetched via `GET /api/analytics/recovery`:
    1. Total Revenue at Risk
    2. Total Revenue Recovered
    3. Recovery Rate (%)
    4. Average Recovery Time (hours)
    5. Successful Recovery Attempts
    6. Failed Recovery Attempts
    7. Escalated Cases Count
    8. Revenue by Intervention Type
  - Recharts AreaChart for time-series recovery/risk, PieChart for execution outcomes, and BarChart for revenue by intervention type.
  - Explicit distinction banner separating business recovery metrics from model evaluation metrics.
- **Model Evaluation Page (`/dashboard/model-evaluation`)**:
  - Reads verified Module 4 XGBoost evaluation metrics directly from `model_metadata.json` via `GET /api/model/evaluation`:
    - Accuracy: **81.72%** (0.8172)
    - Precision: **83.29%** (0.8329)
    - Recall: **96.77%** (0.9677)
    - F1 Score: **89.53%** (0.8953)
    - ROC-AUC: **76.59%** (0.7659)
  - Mandatory disclaimer: *"These are XGBoost MODEL EVALUATION METRICS. They are NOT business recovery metrics."*
  - Detailed metric explanations, Confusion Matrix grid (TN: 65, FP: 282, FN: 47, TP: 1406), and Hyperparameters table.
- **Test Suite Results**:
  - Backend test suite (`npm test`): **7/7 test suites passed, 59/59 tests passed** (including `module9_safety_audit_eval.test.js`).
  - Python AI service test suite (`pytest`): **62/62 tests passed**.
  - Frontend build (`npm run build`): **Completed cleanly with 0 TypeScript/Vite errors**.

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

---

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
