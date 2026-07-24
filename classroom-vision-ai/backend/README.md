# Classroom Vision AI Backend

Optional FastAPI service for command interpretation and realtime control.

## Run

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\\Scripts\\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

The frontend works without this backend because it has a local fallback parser. Set `VITE_AI_API_URL=http://localhost:8000` when you want the frontend to call FastAPI during local development.
