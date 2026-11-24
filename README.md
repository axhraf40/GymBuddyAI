# GymBuddy AI — Interactive Gym & Nutrition Coach Chatbot

> **New developer or AI model?** Read [`PROJECT_CONTEXT.md`](./PROJECT_CONTEXT.md) first for the full project brief, scope, architecture decisions, and changelog.

GymBuddy AI is a full-stack web platform combining:
1. **An intelligent RAG chatbot** (FastAPI + BM25 knowledge retrieval + deterministic nutrition calculator + input/output safety guardrails + Gemini/OpenRouter/Mock LLM support).
2. **An interactive anatomical muscle map** (Next.js + hand-crafted front/back SVG): click any muscle to inspect equipment-filtered exercises and ask targeted workout questions.
3. **A daily coaching n8n automation** (`automation/`) that reads opted-in users from the API, generates a morning coaching email with an LLM, and sends it via SMTP.
4. **Engineering documentation & evaluation suite** (`docs/REPORT.md`, `docs/USER_GUIDE.md`, `docs/DEPLOYMENT.md`, `backend/eval/`).

---

## Quick Start (Local)

### 1. Backend (FastAPI)
```bash
cd backend
python -m venv .venv
# Windows PowerShell:
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env   # optional: set LLM_PROVIDER=gemini and GEMINI_API_KEY=...
uvicorn app.main:app --reload --port 8000
```
- API runs at `http://localhost:8000`
- Interactive OpenAPI docs at `http://localhost:8000/docs`
- By default (`LLM_PROVIDER=mock`), the app runs **100% offline** using the curated knowledge base without needing an API key.

### 2. Frontend (Next.js)
```bash
cd frontend
npm install
npm run dev
```
- Web app runs at `http://localhost:3000`
- Connects to `http://localhost:8000` by default (override with `NEXT_PUBLIC_API_URL` in `frontend/.env.local`).

### 3. Tests & Evaluation Benchmark
```bash
cd backend
.\.venv\Scripts\python -m pytest -v
.\.venv\Scripts\python eval\run_eval.py
```

---

## Project Structure
- [`PROJECT_CONTEXT.md`](./PROJECT_CONTEXT.md) — Single source of truth for all decisions and requirements
- [`backend/`](./backend/) — FastAPI API, RAG engine, guardrails, nutrition calculator, pytest & eval suite
- [`frontend/`](./frontend/) — Next.js + Tailwind web platform with the interactive muscle map
- [`automation/`](./automation/) — Exported n8n workflow JSON, README, architecture & credentials registry
- [`docs/REPORT.md`](./docs/REPORT.md) — PFE-style engineering report (7 required steps)
- [`docs/USER_GUIDE.md`](./docs/USER_GUIDE.md) — User guide & testing instructions for evaluators
- [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md) — Deployment strategy (Render + Vercel + Postgres)
