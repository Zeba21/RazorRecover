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

## License

ISC
