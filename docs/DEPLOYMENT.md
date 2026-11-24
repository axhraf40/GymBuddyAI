# Deployment Strategy — GymBuddy AI

## 1. Architecture in Production
- **Frontend (Next.js):** Deployed on **Vercel** (free Hobby tier, automatic HTTPS, Git-triggered deploys).
- **Backend (FastAPI + Docker):** Deployed on **Render** (free Web Service using `backend/Dockerfile`, automatic HTTPS).
- **Database:** **Render Postgres** or **Supabase Postgres** (connected via `DATABASE_URL`; SQLite works locally, Postgres persists data across Render restarts).
- **LLM API:** Google **Gemini** (`gemini-2.0-flash`, free tier) or **OpenRouter** free model.
- **Automation (n8n):** Self-hosted Docker container or n8n Cloud calling the deployed Render API.

---

## 2. Step-by-Step Deployment

### Step 1: Push the repository to GitHub
```bash
git add .
git commit -m "Initial GymBuddy AI chatbot, muscle map, and n8n automation"
# Create a repo on GitHub, then:
git remote add origin https://github.com/<your-username>/gymbuddy-ai.git
git push -u origin main
```

### Step 2: Deploy the Backend on Render
1. Go to [render.com](https://render.com) → **New + → Web Service** → connect your GitHub repo.
2. Configure:
   - **Root Directory:** `backend`
   - **Runtime:** `Docker`
   - **Instance Type:** Free
3. Add Environment Variables:
   - `LLM_PROVIDER` = `gemini` (or `openrouter`)
   - `LLM_MODEL` = `gemini-2.0-flash`
   - `GEMINI_API_KEY` = `<your key from aistudio.google.com>`
   - `DATABASE_URL` = `<your Postgres URL from Render Postgres or Supabase>` (or omit to use ephemeral SQLite for quick testing)
   - `CORS_ORIGINS` = `https://<your-vercel-app>.vercel.app,http://localhost:3000`
   - `AUTOMATION_API_KEY` = `<a strong random secret>`
4. Deploy and verify `https://<your-backend>.onrender.com/api/health` returns `{"status": "ok", ...}`.

### Step 3: Deploy the Frontend on Vercel
1. Go to [vercel.com](https://vercel.com) → **Add New Project** → import the same GitHub repo.
2. Configure:
   - **Root Directory:** `frontend`
   - **Framework Preset:** Next.js
3. Add Environment Variable:
   - `NEXT_PUBLIC_API_URL` = `https://<your-backend>.onrender.com`
4. Deploy. Open the generated `https://<your-app>.vercel.app` URL and run through `docs/USER_GUIDE.md` §5.

### Step 4: Monitoring & Problem Reporting
- Users report issues directly from the **Report a problem** button in the top bar.
- Check live stats, thumbs-up/down counts, guardrail triggers, and bug reports at:
  ```bash
  curl -H "X-API-Key: <AUTOMATION_API_KEY>" https://<your-backend>.onrender.com/api/admin/stats
  ```
- **Cold-start note (Render free tier):** Free Render services spin down after 15 minutes of inactivity and take ~30 s to wake up on the first request. Send a quick request to `/api/health` 1 minute before the live presentation.
