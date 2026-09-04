# Final Reproducible ₹12,500 Demo Procedure

## 1. Overview

The RazorRecover platform features a 100% repeatable, end-to-end **₹12,500 Failed Payment Demo Scenario**. The demo executes the complete closed-loop revenue recovery pipeline dynamically against Supabase PostgreSQL and `MockPaymentProvider` with **zero hardcoded values or manual database editing required**.

---

## 2. Prerequisites & Server Launch

Ensure all three microservices are running:

```bash
# Terminal 1: Express Backend (Port 5000)
cd backend && npm run dev

# Terminal 2: FastAPI AI Service (Port 8000)
cd ai-service && .venv\Scripts\activate && uvicorn main:app --reload --port 8000

# Terminal 3: React Frontend (Port 5173)
cd frontend && npm run dev
```

Open your browser to `http://localhost:5173`.

---

## 3. Step-by-Step Demo Execution Flow

```
[1. View Initial Dashboard]
           │
           ▼
[2. Click "Run Recovery Demo" / POST /api/demo/payment-failure]
           │
           ▼
[3. Ingest Event & Create Case] ──► (₹12,500 Revenue at Risk)
           │
           ▼
[4. AI Service Prediction] ──► (XGBoost P_recovery = 0.9662, Risk Level = LOW)
           │
           ▼
[5. SHAP Explainability] ──► (High success rate + active status positive factors)
           │
           ▼
[6. LangGraph & Gemini Diagnosis] ──► (Diagnoses soft decline / network timeout)
           │
           ▼
[7. Policy Guardrails Evaluation] ──► (Attempt 1 < 3, Amount ₹12,500 < ₹50k -> APPROVED)
           │
           ▼
[8. Mock Payment Execution] ──► (MockPaymentProvider returns SUCCESS + MOCK_PAY_XXXXXXXX)
           │
           ▼
[9. Supabase DB Settlement] ──► (Case status -> 'recovered', Recovered -> ₹12,500)
           │
           ▼
[10. Real-time UI Refresh] ──► (Dashboard displays +₹12,500 Recovered Revenue)
```

---

## 4. Execution Details & Verification

### Step 1: Initial Dashboard View
- Navigate to `http://localhost:5173`.
- Note baseline metrics on the summary header cards (**Total Revenue at Risk** and **Total Revenue Recovered**).

### Step 2: Trigger Demo Failure Event
- Click the **"Run Recovery Demo"** button on the dashboard top bar (or issue `POST /api/demo/payment-failure`).
- The backend Revenue Event Engine creates a realistic synthetic `PAYMENT_FAILED` event (`pay_failed_demo_...`) for ₹12,500.

### Step 3: Event Ingestion & Case Creation
- The event engine calculates `revenue_at_risk = 12500.00`.
- Inserts a new `recovery_case` with `status = 'open'`.

### Step 4: XGBoost Prediction & SHAP Factors
- The AI service preprocesses customer features and evaluates the XGBoost classifier.
- Returns $P_{recovery} \approx 0.9662$ ($\ge 0.70$), mapping to **LOW Risk Level** (High Recovery Chance).
- SHAP TreeExplainer calculates feature contributions (+18.4% for payment history, +12.1% for active status).

### Step 5: LangGraph Agent & Guardrail Validation
- The 12-state LangGraph agent synthesizes the root cause (*Temporary gateway timeout during recurring charge*) and recommends `RETRY_PAYMENT`.
- Deterministic policy guardrails verify:
  1. Retry count ($0 < 3$) $\rightarrow$ **PASS**.
  2. Transaction amount ($\text{₹}12,500 < \text{₹}50,000$) $\rightarrow$ **PASS**.
  3. Customer opt-out status ($\text{false}$) $\rightarrow$ **PASS**.
  4. Guardrail verdict: **APPROVED**.

### Step 6: Mock Payment Execution & Settlement
- The Node.js Payment Execution Service dispatches the request to `MockPaymentProvider`.
- `MockPaymentProvider` executes payment retry and returns status `SUCCESS` with reference `MOCK_PAY_89234156`.
- The service updates `recovery_cases`:
  - `status`: `'recovered'`
  - `recovered_amount`: `12500.00`
  - `updated_at`: `NOW()`
- Appends execution attempt to `recovery_attempts` and writes entry to `audit_logs`.

### Step 7: Dynamic UI Refresh & Verification
- The dashboard automatically updates without full page refresh:
  - **Revenue Recovered**: Increments by **+₹12,500**.
  - **Live Activity Stream**: Displays *"Recovery case recovered ₹12,500 via MockPaymentProvider"*.
  - **Case Detail Page** (`/dashboard/cases/:caseId`): Shows full timeline, SHAP chart, LLM reasoning, and payment reference ID.

---

## 5. Demo Repeatability & Fresh Events

Because duplicate payment references are rejected by idempotency guardrails, every click of **"Run Recovery Demo"** generates a fresh payment reference UUID (`pay_failed_demo_<timestamp>`), allowing judges and reviewers to re-run the demo flow repeatedly without resetting the database.
