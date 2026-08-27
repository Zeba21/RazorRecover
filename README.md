# RazorRecover

AI-powered revenue recovery agent for Razorpay payment failures.

## Monorepo Structure

```
razorrecover/
├── frontend/        React + Vite + Tailwind CSS (port 5173)
├── backend/         Node.js + Express API     (port 5000)
├── ai-service/      Python + FastAPI           (port 8000)
├── database/        Supabase PostgreSQL migrations
└── docs/            Architecture & documentation
```

## Quick Start

### 1. Environment

Copy the example and fill in your credentials:

```bash
cp .env.example .env
```

### 2. Backend

```bash
cd backend
npm install
npm run dev
```

### 3. AI Service

```bash
cd ai-service
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 4. Frontend

```bash
cd frontend
npm install
npm run dev
```

## Health Endpoints

| Service     | URL                              |
|-------------|----------------------------------|
| Backend     | http://localhost:5000/api/health  |
| AI Service  | http://localhost:8000/health      |
| Frontend    | http://localhost:5173             |

## Environment Variables

| Variable                  | Required | Description                      |
|---------------------------|----------|----------------------------------|
| `SUPABASE_URL`            | Yes      | Supabase project URL             |
| `SUPABASE_SECRET_KEY`     | Yes      | Supabase service-role secret key |
| `SUPABASE_PUBLISHABLE_KEY`| No       | Supabase anon/publishable key    |
| `PORT`                    | Yes      | Backend port (default: 5000)     |
| `NODE_ENV`                | No       | `development` / `production`     |
| `AI_SERVICE_URL`          | No       | AI service URL (default: http://localhost:8000) |
| `GEMINI_API_KEY`          | No       | Google Gemini API key            |

## Revenue Event Engine (Module 3)

The Revenue Event Engine ingests billing events, validates inputs, stores them, computes revenue-at-risk, manages recovery cases, and writes audit logs.

### Supported Event Types
- `PAYMENT_FAILED`
- `PAYMENT_SUCCESS`
- `CHECKOUT_ABANDONED`
- `SUBSCRIPTION_FAILED`
- `INVOICE_OVERDUE`

### Endpoints

#### 1. Ingest Event
`POST /api/events`

**Request Headers**: `Content-Type: application/json`
**Request Body**:
```json
{
  "event_type": "PAYMENT_FAILED",
  "customer_id": "00000000-0000-0000-0000-000000000001",
  "payment_reference": "pay_failed_example_123",
  "amount": 12500,
  "timestamp": "2026-08-27T14:00:00.000Z",
  "metadata": {
    "method": "card",
    "gateway": "razorpay"
  }
}
```

**Response (200 OK)**:
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

#### 2. Trigger Demo Payment Failure
`POST /api/demo/payment-failure`

Generates a realistic mock `PAYMENT_FAILED` event, processes it through the event engine flow, and returns the result.

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "event_id": "de6d003b-cfe7-4cc3-a5af-fe43deb3acf7",
    "event_type": "PAYMENT_FAILED",
    "customer_id": "00000000-0000-0000-0000-000000000001",
    "amount": 12500,
    "revenue_at_risk": 12500,
    "recovery_case_id": "7e458371-f49e-491f-b406-431d0c756a0c",
    "status": "processed"
  }
}
```

### Revenue-at-Risk Behavior
- `PAYMENT_FAILED`, `CHECKOUT_ABANDONED`, `SUBSCRIPTION_FAILED`, and `INVOICE_OVERDUE` have a deterministic revenue-at-risk equal to the event `amount`.
- `PAYMENT_SUCCESS` has a revenue-at-risk of `0.00` and resolves/recovers the matching recovery case.

## License

ISC
