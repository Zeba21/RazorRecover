# RazorRecover Architecture

## Overview

RazorRecover is an AI-powered revenue recovery agent that automatically detects, diagnoses, and recovers failed payments from Razorpay.

## Monorepo Structure

```
razorrecover/
├── frontend/          # React + Vite + Tailwind CSS
├── backend/           # Node.js + Express API
├── ai-service/        # Python + FastAPI (ML & LangGraph)
├── database/          # Supabase PostgreSQL migrations
└── docs/              # Documentation
```

## Technology Stack

| Layer       | Technology                          |
|-------------|-------------------------------------|
| Frontend    | React, Vite, Tailwind CSS, Recharts, Lucide React |
| Backend     | Node.js, Express                    |
| Database    | Supabase PostgreSQL                 |
| AI Service  | Python, FastAPI                     |

## Service Communication

```
┌────────────┐     ┌────────────┐     ┌────────────┐
│  Frontend   │────▶│  Backend    │────▶│ AI Service  │
│  :5173      │     │  :5000      │     │  :8000      │
└────────────┘     └──────┬─────┘     └────────────┘
                          │
                   ┌──────▼─────┐
                   │  Supabase   │
                   │  PostgreSQL │
                   └────────────┘
```

## Ports

| Service     | Port |
|-------------|------|
| Frontend    | 5173 |
| Backend     | 5000 |
| AI Service  | 8000 |
