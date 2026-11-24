# Deployment Strategy — GymBuddy AI

## 1. What is deployed, where

| Part | Host | URL |
|---|---|---|
| Web platform (Next.js) | Vercel project `gymbuddy-ai` | https://gymbuddy-ai-phi.vercel.app |
| Chatbot API (FastAPI) | Vercel project `gymbuddy-api` (Python serverless function `backend/api/index.py`) | https://gymbuddy-api-zeta.vercel.app (`/api/health`, `/docs`) |
| Database | SQLite in `/tmp` on Vercel (see limits); SQLite file locally; any Postgres through `DATABASE_URL` | — |
| LLM | OpenRouter (Auto router + 5 selectable models, fallback chain) | — |
| Dish images | OpenRouter image model (Recraft) | — |
| Automation | n8n (self-hosted Docker or n8n Cloud) calling the API | see `automation/` |

The browser only talks to the web domain. `frontend/next.config.mjs` rewrites `/api/*` to the backend (`BACKEND_INTERNAL_URL` on Vercel), so there is no CORS problem and the backend URL is not hard-coded in the client.

### Why this strategy
- **Vercel for both parts:** free, HTTPS by default, one command to deploy, instant rollback to any previous deployment from the Vercel dashboard. Render (our first plan) puts free services to sleep for ~30 s, which is risky in a live demo.
- **Serverless Python:** FastAPI runs unchanged through `api/index.py`; `vercel.json` raises `maxDuration` to 60 s because free reasoning models can take 10–30 s.
- **Provider-agnostic LLM layer:** changing the model is an environment variable, not a code change. If all models fail, the app still answers from the knowledge base ("Offline answer"), so the demo never shows a blank error.

## 2. Environment variables

Backend (`gymbuddy-api`): `LLM_PROVIDER=openrouter`, `LLM_MODEL=openrouter/free`, `OPENROUTER_API_KEY`, `LLM_FALLBACK_MODELS`, `IMAGE_GEN_API_KEY`, `IMAGE_GEN_MODEL`, `AUTOMATION_API_KEY`, `CORS_ORIGINS`, optional `DATABASE_URL`, `BREVO_API_KEY` / `RESEND_API_KEY` (verification e-mails), `GOOGLE_CLIENT_ID`, `GOOGLE_PLACES_API_KEY`.
Frontend (`gymbuddy-ai`): `BACKEND_INTERNAL_URL=https://gymbuddy-api-zeta.vercel.app`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`.

Secrets live only in Vercel and in the local `backend/.env` (git-ignored). `backend/.env.example` and `frontend/.env.example` list every variable without values.

## 3. How to deploy (or redeploy)

Requirements: Node 20+, a Vercel account with access to both projects.

```powershell
# Backend
cd backend
npx vercel --prod
# Frontend
cd ..\frontend
npx vercel --prod
```
Each folder already contains `.vercel/project.json`, which links it to the right project. After deploying, check:
```powershell
curl https://gymbuddy-api-zeta.vercel.app/api/health
curl "https://gymbuddy-api-zeta.vercel.app/api/health?check_llm=1"
```
`mock_mode` must be `false`; `check_llm=1` makes one real model call and reports which model answered.

Rollback: Vercel dashboard → project → Deployments → previous deployment → **Promote to Production**.

## 4. Test instructions & problem reporting
- Test instructions for evaluators: `docs/USER_GUIDE.md` (§8 checklist) and `docs/TEST_PLAN.md`.
- Users report problems with the **Report** button in the top bar (bug / wrong or unsafe answer / idea / other). Each report is stored with the page it came from.
- Answers can be rated 👍/👎.
- The team reads reports, ratings and guardrail counts with:
  ```powershell
  curl -H "X-API-Key: <AUTOMATION_API_KEY>" https://gymbuddy-api-zeta.vercel.app/api/admin/stats
  ```

## 5. Before the presentation
1. Send the link https://gymbuddy-ai-phi.vercel.app to the teacher **one day before**.
2. 5 minutes before: open `/api/health?check_llm=1` to warm up the function and confirm a model answers.
3. Keep in mind the free AI quota (about 50 requests per day). Avoid testing the chat a lot on presentation day.

## 6. Known limits of this deployment
- **SQLite in `/tmp` is wiped** when Vercel starts a new instance. Accounts survive thanks to a signed token stored in the browser, but conversations and feedback can be lost. Fix: set `DATABASE_URL` to a free Postgres (Neon or Supabase); no code change needed.
- **Free AI quota** (~50 requests/day) and 10–30 s answers from free reasoning models.
- **Pro plan is simulated** (no payment provider).
