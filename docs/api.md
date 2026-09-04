# Complete REST API Documentation

## 1. Express Backend REST APIs (Port 5000)

### 1.1 Health & Verification
- **`GET /api/health`**
  - **Purpose**: System health check.
  - **Response (200 OK)**: `{"status": "ok", "timestamp": "..."}`

---

### 1.2 Event Ingestion Engine
- **`POST /api/events`**
  - **Purpose**: Ingests billing events (`PAYMENT_FAILED`, `PAYMENT_SUCCESS`, `CHECKOUT_ABANDONED`, `SUBSCRIPTION_FAILED`, `INVOICE_OVERDUE`).
  - **Request Body**:
    ```json
    {
      "event_type": "PAYMENT_FAILED",
      "customer_id": "00000000-0000-0000-0000-000000000001",
      "payment_reference": "pay_ref_987654",
      "amount": 12500,
      "timestamp": "2026-09-04T10:00:00.000Z",
      "metadata": { "method": "card", "gateway": "razorpay" }
    }
    ```
  - **Response (200 OK)**:
    ```json
    {
      "success": true,
      "data": {
        "event_id": "de6d003b-cfe7-4cc3-a5af-fe43deb3acf7",
        "event_type": "PAYMENT_FAILED",
        "revenue_at_risk": 12500,
        "recovery_case_id": "7e458371-f49e-491f-b406-431d0c756a0c",
        "status": "processed"
      }
    }
    ```

- **`POST /api/demo/payment-failure`**
  - **Purpose**: Generates a synthetic ₹12,500 payment failure event and creates a recovery case.
  - **Response (200 OK)**: Returns event payload and created recovery case ID.

---

### 1.3 Case & Payment Recovery Execution
- **`POST /api/recovery/:caseId/execute`**
  - **Purpose**: Triggers end-to-end recovery execution (AI service prediction -> SHAP -> LLM diagnosis -> Guardrails -> Provider execution).
  - **Response (200 OK)**: Returns guardrail verdict, execution outcome, provider reference, and updated case.

- **`POST /api/recovery/:caseId/retry`**
  - **Purpose**: Directly executes payment retry via `MockPaymentProvider`.

- **`GET /api/recovery/:caseId/status`**
  - **Purpose**: Returns recovery status, attempt count, and audit log entries.

- **`GET /api/recovery/:caseId/detail`**
  - **Purpose**: Serves case detail, XGBoost probability, SHAP factors, payment metadata, and audit timeline.

---

### 1.4 Webhooks
- **`POST /api/webhooks/mock-payment`**
  - **Purpose**: Webhook listener receiving simulated payment provider callbacks (`payment.success`, `payment.failed`). Validates idempotency keys.

---

### 1.5 Dashboard & Analytics APIs
- **`GET /api/dashboard/summary`**: Aggregate KPIs (Revenue at Risk, Recovered Revenue, Recovery Rate %, Active Cases).
- **`GET /api/dashboard/revenue`**: Time-series revenue data for Recharts AreaChart.
- **`GET /api/dashboard/cases`**: Searchable, filterable list of recovery cases (`status`, `risk_level`, `search`).
- **`GET /api/recovery/activity`**: Real-time AI agent activity log stream.
- **`GET /api/audit`**: Paginated audit explorer records with search, action, and guardrail filters.
- **`GET /api/analytics/recovery`**: Real database-derived business recovery analytics (Total Risk, Total Recovered, Recovery Rate %, Average Recovery Time, Successful/Failed Attempts, Escalated Cases, Revenue by Intervention Type).
- **`GET /api/model/evaluation`**: Verified XGBoost model evaluation metrics directly from `model_metadata.json`.

---

## 2. FastAPI AI Microservice REST APIs (Port 8000)

### 2.1 Health Check
- **`GET /health`**
  - **Response (200 OK)**: `{"status": "ok", "service": "RazorRecover AI Service", "version": "1.0.0"}`

---

### 2.2 Predict Recovery (Module 4)
- **`POST /predict-recovery`**
  - **Request Body**:
    ```json
    {
      "transaction_amount": 12500.0,
      "customer_payment_history": 12,
      "previous_success_rate": 0.92,
      "previous_failure_count": 1,
      "failure_type": "gateway_timeout",
      "retry_count": 0,
      "customer_age_days": 180,
      "subscription_status": "active",
      "time_since_failure": 2.5,
      "payment_method": "card",
      "customer_segment": "pro",
      "invoice_age": 1.0,
      "previous_recovery_success": 1
    }
    ```
  - **Response (200 OK)**:
    ```json
    {
      "recovery_probability": 0.9662,
      "risk_level": "LOW",
      "model_version": "recovery-xgboost-v1.0"
    }
    ```

---

### 2.3 Explain Recovery (Module 5 SHAP)
- **`POST /explain-recovery`**
  - **Request Body**: Same feature payload as `/predict-recovery`.
  - **Response (200 OK)**:
    ```json
    {
      "recovery_probability": 0.9662,
      "risk_level": "LOW",
      "positive_factors": [
        { "feature": "previous_success_rate", "value": 0.92, "impact": 0.184 },
        { "feature": "subscription_status", "value": "active", "impact": 0.121 }
      ],
      "negative_factors": [],
      "explanation_narrative": "High historical payment success rate (0.92) and active subscription status positively influence recovery chance."
    }
    ```

---

### 2.4 Run Agent Workflow (Module 6 LangGraph)
- **`POST /agent/run-workflow`**
  - **Request Body**: `{"case_id": "7e458371-f49e-491f-b406-431d0c756a0c", "features": {...}}`
  - **Response (200 OK)**: Returns full 12-state execution log, root-cause diagnosis, recommended action, guardrail result, and execution outcome.
