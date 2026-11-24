# Test Plan & Results — GymBuddy AI

This file is the evidence for report **Step 6 (Evaluate & improve)**. It lists what we test, how, and the latest measured results.

## 1. Test levels

| Level | Tool | What it covers | How to run |
|---|---|---|---|
| Unit | `pytest` (`backend/tests/test_units.py`) | Mifflin-St Jeor maths, calorie floor, BM25 retrieval, allergen exclusion, muscle detection EN/FR, guardrails (injection, steroids, eating disorders, off-topic) | `cd backend` then `.venv\Scripts\python -m pytest -q` |
| API / integration | `pytest` + FastAPI `TestClient` (`backend/tests/test_api.py`) | Every endpoint: users, auth, chat, conversations, ratings, feedback, muscles, workouts, restaurants, n8n API key protection | same command |
| Chatbot quality | `backend/eval/run_eval.py` + `eval/questions.json` (16 questions) | Relevance keywords, refusals, disclaimers, allergen safety, French answers, ambiguous questions | `.venv\Scripts\python eval\run_eval.py` |
| End-to-end (browser) | Playwright script driving Chrome (headless) | Every page and main button, local and on the live site | see §4 |
| Manual | Teacher checklist in `docs/USER_GUIDE.md` §8 | The demo scenarios | by hand |

## 2. Automated results (24 Nov 2026)

| Suite | Result |
|---|---|
| `pytest` | **32 / 32 passed** |
| Evaluation, offline knowledge-base mode (`mock`) | **16 / 16 (100 %)**, avg latency 4 ms (`eval/results_mock.json`) |
| Evaluation, live LLM (OpenRouter, Auto router) | **14 / 16 (87.5 %)**, avg latency 11.8 s (`eval/results.json`) |
| `next build` | passes, 0 type errors |

### Live-LLM evaluation failures (error analysis)
| Id | Question | Why it failed | Decision |
|---|---|---|---|
| Q04 | French workout question | The answer was correct but in French ("développé couché") so the English keyword "press" was missing | Checker too strict: accept FR synonyms (future work) |
| Q16 | Snack with a peanut allergy | The answer *warned* about peanuts; the check is a plain keyword match, so a warning counts as a mention | Checker should look for warning context (future work); the output guardrail behaved correctly |

## 3. End-to-end browser test (24 Nov 2026)

The same scripted run was executed on `http://localhost:3000` and on the live site `https://gymbuddy-ai-phi.vercel.app`.

| # | Page | Step | Local | Live | Notes |
|---|---|---|---|---|---|
| 1 | /login | Create account | ✅ | ✅ | Without an email provider the account is verified at once; with Brevo/Resend a 6-digit code is required |
| 2 | /login | Sign out / sign in with username | ✅ | ✅ | |
| 3 | /login | Wrong password shows "Invalid email/username or password." | ✅ | ✅ | |
| 4 | /login | Forgot password form | ✅ | ✅ | Unknown e-mail returns HTTP 404 (no code sent) |
| 5 | /login | Google sign-in button | ⚠️ | ✅ | Google refuses `localhost` (origin not allowed for the client id); on the Vercel domain the button loads with no error (full Google login not automated) |
| 6 | /coach | Profile modal → daily targets (2802 kcal, 126 g protein…) | ✅ | ✅ | |
| 7 | /coach | Muscle map front + back, chips, exercise list | ✅ | ✅ | |
| 8 | /coach | Exercise animation (GIF) modal | ✅ | ✅ | Escape did not close it → **fixed** |
| 9 | /coach | Model menu lists Auto + 5 models | ✅ | ✅ | |
| 10 | /coach | Chat answer with sources `[S1]…` and "AI" badge | ✅ | ✅ | Live frontend still showed the raw model id in the badge → **needs redeploy** |
| 11 | /coach | 👍 rating saved | ✅ | ✅ | |
| 12 | /coach | Manual barcode (3017620422003) → product + nutrition | ✅ | ✅ | |
| 13 | /coach | Live barcode scanner opens the camera | ✅ | ✅ | fake camera in headless Chrome |
| 14 | /coach | New conversation, history, delete conversation | ✅ | ✅ | |
| 15 | /coach | Report a problem → saved (HTTP 200) | ✅ | ✅ | Escape did not close it → **fixed** |
| 16 | /gym | Start chrono, set done → rest timer, Busy → swap, Do now, water, voice toggle, 15 splits | ✅ | ✅ | |
| 17 | /nutrition | Recipe filters, search, load more | ✅ | ✅ | 147 recipes |
| 18 | /nutrition | Restaurants by city (Rabat: 12 results) | ✅ | ✅ | |
| 19 | /nutrition | Restaurants by GPS | ✅ | ✅ | |
| 20 | /nutrition | Fridge AI chef + generated dish image | ✅ | ✅ | 29 s local, 52 s live |
| 21 | /pricing | Monthly/annual toggle, Start Pro → "Pro activated" | ✅ | ✅ | Demo activation, no real payment |
| 22 | all | Internal links resolve, `/terms`, `/privacy`, 404 page | ✅ | ✅ | `/favicon.ico` was missing (404 on every page) → **fixed** |

## 4. How to re-run the browser test
The script is not part of the app. It uses `playwright-core` with the installed Chrome:
```
npm i playwright-core
node flow.js http://localhost:3000 ./shots llm
```
`llm` enables the two steps that spend AI quota (one chat, one fridge meal). Without it the run uses no AI calls.

## 5. Robustness checks
- Empty / >2000-character messages → HTTP 422, error banner in the UI.
- Prompt injection, steroid cycles, starvation diets, off-topic code requests → blocked before the LLM (`provider: guardrail`).
- LLM error, 429 or empty reasoning output → next model in `LLM_FALLBACK_MODELS`, then offline knowledge-base answer marked "Offline answer".
- Backend unreachable → clear error banner in the chat.
