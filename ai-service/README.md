# RazorRecover AI Service

## Setup

```bash
cd ai-service
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt
```

## Run

```bash
uvicorn main:app --reload --port 8000
```

## Endpoints

| Method | Path      | Description     |
|--------|-----------|-----------------|
| GET    | `/`       | Service info    |
| GET    | `/health` | Health check    |
| GET    | `/docs`   | Swagger UI      |
