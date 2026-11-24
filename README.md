# GymBuddy AI — Gym & Nutrition Coach Chatbot

> **New developer or AI model?** Read [`PROJECT_CONTEXT.md`](./PROJECT_CONTEXT.md) first: scope, decisions and changelog.

**Live:** https://gymbuddy-ai-phi.vercel.app · **API:** https://gymbuddy-api-zeta.vercel.app/docs

GymBuddy AI is a web platform built around a RAG chatbot for gym beginners:
1. **AI coach chat** (FastAPI): input guardrails → BM25 retrieval over 281 curated documents → LLM (OpenRouter Auto router + 5 selectable models, with fallback) → output safety checks. Profile, daily targets, selected muscle and the last 10 messages are sent as context.
2. **Interactive muscle map** (hand-made SVG, front/back, 15 muscles) with animated exercise demos.
3. **Platform pages:** accounts (`/login`), coach (`/coach`), in-gym chrono (`/gym`), nutrition with AI fridge chef + generated dish picture, restaurants nearby and 147 recipes (`/nutrition`), plans (`/pricing`).
4. **Photo & barcode:** identify a machine, a plate or a barcode from a photo; live barcode scanner (Open Food Facts).
5. **n8n automations** (`automation/`): daily coaching e-mail, CRM workflow, Telegram coach.
6. **Docs:** report, user guide, test plan, deployment (`docs/`).

## Quick start (local, Windows PowerShell)

### Backend
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload --port 8000
```
- With `LLM_PROVIDER=mock` (default) everything runs offline from the knowledge base, no key needed.
- For real AI answers set `LLM_PROVIDER=openrouter` and `OPENROUTER_API_KEY` in `backend/.env`.
- API docs: http://localhost:8000/docs · health: http://localhost:8000/api/health

### Frontend
```powershell
cd frontend
npm install
npm run dev
```
Open http://localhost:3000. The Next.js server forwards `/api/*` to `http://127.0.0.1:8000` (change with `BACKEND_INTERNAL_URL`).

### Tests
```powershell
cd backend
.\.venv\Scripts\python -m pytest -q        # 32 tests
.\.venv\Scripts\python eval\run_eval.py     # 16-question chatbot evaluation
cd ..\frontend
npm run build                               # type check + production build
```
Latest results are in [`docs/TEST_PLAN.md`](./docs/TEST_PLAN.md).

## Project structure
- `backend/` — FastAPI API (`app/`), knowledge base (`app/data/`), tests, evaluation, Vercel entry (`api/index.py`)
- `frontend/` — Next.js + Tailwind (`src/app/*` pages, `src/components/*`)
- `automation/` — n8n workflows (JSON), README with architecture, credentials registry, transferability test
- `docs/REPORT.md` — engineering report (7 steps) · `docs/USER_GUIDE.md` — user guide + evaluator checklist · `docs/TEST_PLAN.md` — tests and results · `docs/DEPLOYMENT.md` — deployment strategy
