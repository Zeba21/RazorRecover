# Safety System & Deterministic Guardrails

## 1. Overview

A core architectural principle of RazorRecover is:

> **LLM Recommendation $\neq$ Automatic Permission.**

While the LangGraph agent and Gemini LLM provide diagnostic insight and recommend interventions, **deterministic policy guardrails** have exclusive control over execution approval. The LLM cannot execute code, bypass security boundaries, or trigger unauthorized transactions.

---

## 2. Deterministic Guardrail Rules

| Guardrail Rule | Trigger Condition | Deterministic Enforcement |
| :--- | :--- | :--- |
| **1. Maximum Retry Limit** | Attempt count $\ge 3$ | Blocks 4th retry. Overrides action to `ESCALATE_TO_HUMAN`. |
| **2. Successful Payment Stop** | Payment status is `captured` or case status is `recovered` | Blocks execution immediately. Returns `STOP`. |
| **3. Customer Opt-Out** | Customer profile flag `opted_out = true` | Blocks all recovery outreach and retries. Returns `STOP`. |
| **4. High-Value Human Approval** | Transaction amount $\ge \text{₹}50,000$ | Blocks automated execution. Overrides action to `FLAG_FOR_HUMAN_APPROVAL`. |
| **5. Duplicate Event Idempotency** | Event `payment_reference` or attempt `idempotency_key` already exists | Rejects execution attempt. Returns existing database record idempotently. |
| **6. Invalid Action Rejection** | LLM outputs unrecognized or malformed action string | Rejects action. Applies fallback intervention `SEND_SMART_REMINDER`. |
| **7. Non-Negative Amount Constraint** | Request body amount $< 0$ | Rejects HTTP request with `400 Bad Request`. |
| **8. Rate Limiting** | HTTP request count exceeds rate limit | Blocks API access with `429 Too Many Requests`. |
| **9. Secret & Error Suppression** | Unhandled exception or internal database error | Suppresses stack traces, connection strings, and API keys. Returns generic `500 Internal Server Error`. |

---

## 3. Implementation Locations

- **Backend Policy Middleware**: `backend/src/services/paymentService.js` and `backend/src/middleware/rateLimiter.js`.
- **Input Validation**: `backend/src/middleware/validateInput.js` (UUID regex validation, enum enforcement).
- **Error Sanitization**: `backend/src/middleware/errorHandler.js`.
- **Database Constraints**: `database/migrations/007_module9_safety_constraints.sql` (PostgreSQL `CHECK` constraints on amounts and partial unique index on idempotency keys).

---

## 4. Audit Logging & Compliance

Every guardrail evaluation, action attempt, and state transition writes an immutable record to the `audit_logs` table:

```json
{
  "id": "a1b2c3d4-5678-90ab-cdef-1234567890ab",
  "actor": "GUARDRAIL",
  "entity_type": "recovery_case",
  "entity_id": "7e458371-f49e-491f-b406-431d0c756a0c",
  "action": "RETRY_PAYMENT",
  "reason": "Retry attempt 1 of 3 authorized under maximum retry policy.",
  "guardrail_result": "APPROVED",
  "execution_result": "SUCCESS",
  "amount": 12500.00,
  "created_at": "2026-09-04T10:30:00.000Z"
}
```

Audit records can be inspected in real time via the **Audit Explorer Page** (`/dashboard/audit`) or `GET /api/audit`.
