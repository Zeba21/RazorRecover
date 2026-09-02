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
| **Module 8** | Dashboard & UI Integration | ⏳ PENDING | Frontend Integration & Visual Demonstration (Not Started) |

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
