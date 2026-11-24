# PROJECT CONTEXT: read this first (handoff file for any AI model / developer)

> This file holds **everything decided about this project so far**. If you are a new AI model or a new developer, read it fully before touching the code.
> Keep it up to date: when a decision changes, edit the relevant section and add a line to the **Changelog** at the bottom.

---

## 1. What this project is (school assignment)

The project is a university assignment (teacher: **Dr. Hasnâ CHAABI**, course "Generative text AI"). The original instructions are in `this what should be/`:
- `PROJET.txt`: presentation rules + automation deliverables.
- `Guide - Livrables_Projet_Chatbot.pdf`: chatbot project guide (2 pages, French).

There are **two graded parts**:

### Part A: Chatbot project (20 min presentation including the live demo)
Four required pieces that must work together:
1. **An intelligent chatbot** built for a clearly identified need, with a **response generation strategy**, a **context management mechanism**, and **response quality control methods**.
2. **A platform that includes the chatbot**: a usable interface connected to the backend + chatbot, with consistent handling of inputs, responses, errors and interactions.
3. **An accessible deployment**: a live version + **test instructions** + a **way to report problems** + a written **deployment strategy**. The **link must be sent to the teacher 1 day before** the presentation (or an executable for offline apps).
4. **A PFE-style engineering report** (FR or EN). It must stay short; the team must **know every line** (the teacher asks questions based on it). It must trace requirements, decisions, changes, tech choices (**justified**), tests, results, limits, and the improvements made to the chatbot. Required structure (7 steps):
   1. Describe the problem → initial requirements (cahier des charges) + needs analysis.
   2. Break down & organize → detailed requirements, use cases, functional breakdown, error cases, platform↔chatbot interactions.
   3. Structure the solution → architecture, prototypes, technical decisions (model, backend, DB, generation strategy, security, tests), versioned implementation.
   4. Generalize & transfer → transferability demo (other users / questions / dataset) + limits of generalization.
   5. Communicate → report, technical docs, user guide, demo.
   6. Evaluate & improve → test plan, measurable results, error analysis, robustness to ambiguous/unexpected questions, documented improvements.
   7. Reflect → wrong assumptions, lessons learned, decisions we'd change, tasks that must stay under human control, future work.

> Every decision must be **justified** (by requirements, constraints, a comparison of options, or test results).

### Part B: Automation project (5–10 min presentation)
Deliverables: the filled-in teacher guide · the **n8n workflow exported as JSON** · **README** (install + usage) · technical environment · dependencies · **architecture diagram** (trigger → processing → AI → external integrations → result, with data flows) · **credentials & variables registry** (services, credential type, required permissions, steps to recreate the connections on a new machine) · **transferability test** (a friend uses the automation with only our docs + our reflection on the experience).

**Deadline:** presentations start in the **first week of December 2026**. Today is 2026-11-20.

---

## 2. History of the idea (why the scope changed)
1. The user first designed a big **commercial gym SaaS** (web + mobile app, background AI agents, smart gym timer, payments, restaurants, photo logging, 4 languages, Ramadan mode…). It is archived in `docs/archive/ORIGINAL_SAAS_SPEC.md`, `docs/archive/ORIGINAL_DECISIONS.md` and `docs/MARKET_RESEARCH.md`.
2. A gap analysis against the teacher's files showed: **no chatbot**, no deployment, no report, no n8n automation, and a scope far too big for ~2 weeks.
3. **Decision (2026-11-20):** keep the gym/nutrition topic, but re-center the project on a **deployed chatbot inside a web platform** + an **n8n automation**. Everything else becomes "future work" in the report.

---

## 3. The product: "GymBuddy AI", an AI gym & nutrition coach chatbot

### Need
People who start going to the gym don't know which exercises to do for which muscle, how many sets/reps, how much to eat, or what to cook. Today they piece it together from YouTube, random forums, expensive coaches (~\$199/mo) or 3–4 separate apps (see `docs/MARKET_RESEARCH.md`). Generic chatbots (ChatGPT) don't know their profile, can make up unsafe advice, and don't show exercises visually.

### Target users
Gym beginners and intermediate lifters (students, young workers), FR/EN speakers, including people with halal diets.

### Main features (MVP = what we build now)
1. **Onboarding questionnaire** → user profile: age, sex, height, weight, activity level, goal (lose fat / build muscle / recomp / maintain), experience, days per week, equipment (full gym / home dumbbells / bodyweight), diet (halal, vegetarian…), allergies, injuries, medical conditions.
2. **Chatbot** (main feature): answers workout / exercise / nutrition / recipe / meal-prep questions, personalized with the profile.
3. **Interactive muscle map** (user's idea, 2026-11-20): an anatomical body figure (front + back views) next to the chat. The user **clicks a muscle** (chest, shoulders, biceps, abs, quads…). The muscle lights up red, the panel shows the exercises for that muscle (adapted to the user's equipment), and **suggested questions** appear ("Best exercises for my chest at home?", "How many sets for biceps?"). The selected muscle is sent with the chat message as context. Inspiration image: `docs/archive/muscle_map_inspiration.jpg` (**not** the final image; we draw our own SVG so every muscle is clickable).
4. **Calorie & macro targets** computed with a formula (Mifflin-St Jeor + activity factor + goal adjustment), shown on the profile and used by the chatbot.
5. **Conversation history** (several conversations per user, reloadable).
6. **Answer feedback** (👍/👎 per answer) + **"Report a problem"** form (deployment requirement).
7. **Safety**: medical disclaimer, refuses dangerous requests (extreme diets, steroids, eating disorder behaviour), calorie floor, never suggests the user's allergens, avoids exercises that conflict with declared injuries, redirects off-topic questions.

### Future work (NOT in MVP; mention in report step 7)
Mobile app, smart gym session timer, meal-photo logging, barcode scan, restaurant finder, payments/freemium, Arabic RTL + Spanish, Ramadan mode, wearables sync, progress photos, multi-agent LangGraph.

---

## 4. Technical decisions (with justification, reuse in report step 3)

| # | Topic | Decision | Why (vs. alternatives) |
|---|---|---|---|
| T1 | Backend | **Python FastAPI** | Python = best AI ecosystem; FastAPI is async, auto-generates OpenAPI docs (`/docs`) useful for testing & the report; lighter than Django |
| T2 | Frontend | **Next.js (React, TypeScript)**, single web app | Required "platform"; deploys free on Vercel; the mobile app was dropped (not graded, too long) |
| T3 | LLM | **Provider-agnostic, OpenAI-compatible client**: Gemini (via its OpenAI-compatible endpoint) or OpenRouter free models; a **`mock` provider** works with no API key | Free for testing; switching model = changing env vars; mock mode keeps the demo and the tests working offline / without quota |
| T4 | Generation strategy | **RAG** (retrieval-augmented generation) over our own curated knowledge base (exercises, foods with macros, training/nutrition principles, recipes) + **profile injection** + **deterministic tools** (calorie/macro calculator) | Limits hallucinations, answers are grounded and **cite sources**; numbers (calories) come from code, not from the LLM |
| T5 | Retrieval | **BM25** keyword ranking implemented in Python (no vector DB), boosted by the selected muscle | Small corpus (~150 docs) → BM25 is fast, free, deterministic and explainable; embeddings/vector DB = possible improvement |
| T6 | Context management | Conversation stored in DB; each request sends: system prompt + user profile + computed targets + selected muscle + **last N=10 messages** + retrieved docs; older messages are dropped (sliding window) | Keeps the prompt small and cheap while remembering the conversation and the user |
| T7 | Quality control | **Input guardrails** (off-topic, dangerous/medical, prompt injection, empty/too long) → **output checks** (allergen mentions, disclaimer on health topics, fallback on LLM errors) + 👍/👎 feedback + **automated evaluation set** (`backend/eval/`) | Required by the guide; measurable results for report step 6 |
| T8 | Database | **SQLAlchemy** with **SQLite** locally; **Postgres (Supabase / Render)** in production via `DATABASE_URL` | Zero setup for dev/teacher; same code in production |
| T9 | Auth | No password auth in MVP: anonymous user id (UUID) stored in the browser | Saves time; acceptable for a course demo; listed as a limit |
| T10 | Multi-agent LangGraph | **Dropped for MVP**: a single pipeline (guardrails → retrieval → LLM → checks) | Easier to explain, test and defend in 20 min; LangGraph = future work |
| T11 | Muscle map | **Hand-made inline SVG** React component (front + back), each muscle is a clickable `<path>` with an id | Full control, no licence issues, works offline, highlights on hover/select |
| T12 | Deployment | Backend: **Docker → Render** (free web service); Frontend: **Vercel**; DB: Render Postgres or Supabase | Free tiers, Git-based deploys, HTTPS by default |
| T13 | Automation | **n8n** workflow: daily schedule → call backend `/api/automation/daily-digest` (API key) → LLM writes each user's daily coaching message → send by **email (Gmail/SMTP)** and/or **Telegram** → log result | Teacher requires n8n; reuses the chatbot's data → one coherent project |
| T14 | UI language | **English** UI; the chatbot answers in the user's language (FR/EN) | The teacher accepts FR or EN |

---

## 5. Repository layout
```
gym app/
├── PROJECT_CONTEXT.md        ← THIS FILE (single source of truth)
├── README.md                 ← how to install / run / test / deploy
├── backend/                  ← FastAPI chatbot API
│   ├── app/
│   │   ├── main.py           ← FastAPI app + routes
│   │   ├── config.py         ← env settings
│   │   ├── db.py, models.py, schemas.py
│   │   ├── llm.py            ← provider-agnostic LLM client (gemini / openrouter / mock)
│   │   ├── retrieval.py      ← BM25 over knowledge base
│   │   ├── guardrails.py     ← input/output safety checks
│   │   ├── nutrition.py      ← BMR/TDEE/macros calculator
│   │   ├── chatbot.py        ← the pipeline (guardrails → RAG → LLM → checks)
│   │   └── data/             ← knowledge base JSON (exercises, foods, principles, recipes)
│   ├── tests/                ← pytest unit/integration tests
│   ├── eval/                 ← evaluation question set + script (metrics for the report)
│   ├── requirements.txt, Dockerfile, .env.example
├── frontend/                 ← Next.js web app (onboarding, chat, muscle map, feedback)
├── automation/               ← n8n workflow JSON + README + architecture + credentials registry
├── docs/
│   ├── REPORT.md             ← PFE report draft (7 steps)
│   ├── USER_GUIDE.md, TEST_PLAN.md, DEPLOYMENT.md
│   ├── MARKET_RESEARCH.md
│   └── archive/              ← original SaaS spec (history)
└── this what should be/      ← teacher's instructions (do not edit)
```

## 6. API contract (backend)
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | status + active LLM provider |
| POST | `/api/users` | create user with profile → `{user_id, profile, targets}` |
| GET / PUT | `/api/users/{id}` | read / update profile (+ computed targets) |
| GET | `/api/muscles` | list of muscles (id, name, view front/back) |
| GET | `/api/muscles/{muscle_id}/exercises?user_id=` | exercises for a muscle (filtered by the user's equipment) + suggested questions |
| POST | `/api/chat` | `{user_id, conversation_id?, message, muscle?}` → `{conversation_id, message_id, reply, sources[], flags[], suggestions[]}` |
| GET | `/api/users/{id}/conversations` | list conversations |
| GET | `/api/conversations/{id}/messages` | messages of a conversation |
| POST | `/api/messages/{id}/rating` | `{rating: 1 or -1}` |
| POST | `/api/feedback` | "Report a problem" `{user_id?, kind, text, page?}` |
| GET | `/api/automation/daily-digest` | header `X-API-Key`; data for n8n (users + today's focus + targets) |

## 7. Environment variables (backend `.env`)
`LLM_PROVIDER` (`mock` | `gemini` | `openrouter`), `LLM_MODEL`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY`, `DATABASE_URL` (default `sqlite:///./gymbuddy.db`), `CORS_ORIGINS`, `AUTOMATION_API_KEY`, `HISTORY_WINDOW` (default 10), `RETRIEVAL_TOP_K` (default 5).
Frontend: `NEXT_PUBLIC_API_URL` (default `http://localhost:8000`).

## 8. Status / next steps
See the Changelog. Remaining human tasks: get a Gemini or OpenRouter API key, deploy (Render + Vercel), run the transferability test with a friend (chatbot + n8n), fill the teacher's automation guide, finalize the report with the real test results, rehearse the 20-min demo.

---

## Changelog
- **2026-11-20**: Gap analysis done. Scope changed from the full SaaS to chatbot + platform + deployment + report + n8n. Added the interactive muscle map idea. Tech decisions T1–T14 recorded.
- **2026-11-20 (build complete)**:
  - Backend (`backend/`): FastAPI API, 131-doc knowledge base (muscles, exercises, foods, recipes, principles), BM25 retrieval with muscle boost & allergen filtering, Mifflin-St Jeor nutrition calculator, input/output guardrails, Gemini/OpenRouter/Mock LLM client, 26/26 pytest tests passing, 16/16 eval benchmark passing (`eval/run_eval.py`), Dockerfile.
  - Frontend (`frontend/`): Next.js + Tailwind dark athletic UI with onboarding/profile modal, daily targets card, conversation history, RAG source badges, 👍/👎 ratings, Report a Problem modal, and hand-crafted front/back interactive SVG `MuscleMap` with equipment/injury-filtered exercise inspector. Production `next build` passes with 0 errors.
  - Automation (`automation/`): Exported n8n workflow (`workflow_daily_coach.json`) + full documentation (`automation/README.md`: architecture, env, credentials registry, transferability template).
  - Docs: `README.md`, `docs/REPORT.md` (7-step PFE report), `docs/USER_GUIDE.md`, `docs/DEPLOYMENT.md`.
- **2026-11-20 (exercise GIFs + equipment photo recognition)**:
  - Enriched all 55/55 exercises in `backend/app/data/exercises.json` with real animated GIFs, thumbnails, and EN/FR step-by-step instructions from `hasaneyldrm/exercises-dataset` via `backend/scripts/enrich_exercises.py`.
  - Added `backend/app/data/equipment.json` (15 core gym machines modeled on the Bangkit Academy / Roboflow gym equipment datasets) to the RAG index.
  - Added multimodal vision endpoint `POST /api/equipment/identify` (OpenRouter free vision models + RAG grounding + safety checks) and a Camera/Upload button (`📷`) + Exercise Demo GIF modal in `frontend/src/app/page.tsx`.


- **2026-11-21 → 11-22 (reconstructed from the files on 2026-11-23; not logged at the time)**:
  - Deployed on **Vercel** (not Render): frontend project `gymbuddy-ai`, backend project `gymbuddy-api` (`backend/api/index.py` + `vercel.json`). On Vercel the default DB is SQLite in `/tmp`, which is wiped on every cold start.
  - Scope grew beyond the MVP: email/password accounts with email verification codes (Brevo / Resend / Gmail SMTP), Google sign-in, forgot/reset password (`/login`), Free/Pro plans (`/pricing`, `POST /api/users/{id}/plan`), gym session page with "equipment busy → swap" and voice cues (`/gym`, `GET /api/workouts/session`), nutrition page with large recipe base, barcode scanner, nearby restaurants via OpenStreetMap and "fridge meals" with a Recraft dish image (`/nutrition`), chat moved to `/coach`, new landing page `/`.
  - Automation v2: 16-node n8n CRM workflow `automation/workflow_gymbuddy_crm.json` (lead scoring, Google Sheets upsert, segmented AI emails, admin KPI digest) + `crm_template.csv`.
  - To survive Vercel's wiped SQLite, users are re-created from a signed `auth_token` (contains the password hash, signed with `AUTOMATION_API_KEY`). Workaround only; conversations are still lost on cold start.
- **2026-11-23 (status check)**: pytest **27/27** pass, eval **16/16** (mock), `next build` passes (7 routes). Open issues: (1) production needs a real Postgres `DATABASE_URL` (Neon/Supabase free) so the token-restore hack can be removed and the password hash no longer leaves the server; (2) `README.md`, `docs/REPORT.md`, `docs/DEPLOYMENT.md`, `docs/USER_GUIDE.md` still describe the Nov 20 MVP (Render, 26 tests, no accounts/pricing pages); (3) the live-LLM eval run, the teacher's automation guide and the transferability test are still to do; (4) the folder has no git commit yet.
- **2026-11-23 (OpenRouter really used now)**: Root causes of "canned" answers: (a) the Vercel backend deployment predated its env vars, so it ran in mock mode; (b) free OpenRouter models are reasoning models and spent the whole `max_tokens` thinking, returning empty content, and the code silently fell back to the offline composer; (c) the deployed frontend's `/api` rewrite pointed at localhost. Fixes: `llm.py` adds a reasoning token budget (`LLM_REASONING_BUDGET`, reasoning effort low), tries `LLM_FALLBACK_MODELS` in order on errors / 429 / empty answers (stops on 401/402), `GET /api/health?check_llm=1` diagnostic; chat UI shows an "AI: model" or "Offline answer" badge per reply; `vercel.json` maxDuration 60; frontend rewrites to `BACKEND_INTERNAL_URL` (set on Vercel). Redeployed both. Results: pytest 29/29; live eval with OpenRouter **14/16 (87.5%)**, avg latency ~11.8 s (mock baseline kept in `eval/results_mock.json`). Failures: Q04 (French workout answer lacked the keyword "press"), Q16 (answer mentions "peanut" as a warning; the check is a plain keyword match). Production: frontend https://gymbuddy-ai-phi.vercel.app, backend https://gymbuddy-api-zeta.vercel.app. Free tier = 50 OpenRouter requests/day.
- **2026-11-23 (workout order + Yuka-style scanner)**: `/gym` keeps a per-exercise count of completed sets; any unfinished exercise in the queue can be tapped ("Do now") and the user comes back to the others later; after the last set of an exercise the next unfinished one (wrapping around) is chosen; the workout finishes only when every exercise is done. Barcode scanner rewritten: `html5-qrcode` (only read inside its box) replaced by `barcode-detector` (Sec-ant, ponyfill of the Barcode Detection API on **ZXing-C++** WebAssembly; native BarcodeDetector used when available). It decodes the whole frame plus a 2x centre crop (software zoom), cycles hardware zoom levels while nothing is found, offers a zoom slider and torch. The wasm is self-hosted at `frontend/public/zxing/` (copied by `npm postinstall`). Tested headless with a fake camera: a small, tilted EAN-13 in the corner of the frame was read in under 1 s.
- **2026-11-23 (n8n Telegram coach)**: Added `automation/workflow_telegram_coach.json` (65 nodes, built-in only) + `automation/TELEGRAM_COACH.md` + `tg_subscribers/workouts/meals.csv`. Telegram bot commands /link /today /workout /eat (location or city) /done (streak + badges) /log (AI macros) /report (progress bars) /stop, free text via `/api/chat` with AI backup; schedules 07:30 AI brief, 20:30 nudge, Sunday 19:00 AI recap. Based on n8n community templates #7756 (John Alejandro Silva) and #16969 (Dr. Firas). Code-node JS tested on sample data; not yet run in a live n8n.
- **2026-11-23 (restaurants + AI wording)**: nearby restaurants now query nodes+buildings on 3 Overpass mirrors with a User-Agent, widen 1.5 km -> 4 km when few results, rank healthiest first (Healthy pick, Halal/Vegetarian/Vegan badges), dish suggestions by cuisine+diet+goal, clear errors (404 unknown city, 503 map busy). User asked not to mention OpenRouter/free models in the frontend UI only (README/docs/report keep mentioning OpenRouter); UI now says AI models / GymBuddy AI. Also removed "SaaS" and "demo" from visible frontend text (Plans, Coach, guides, Watch). pytest 31/31, `next build` passes.

- 2026-11-23: Restaurants can use Google Places API (New) when GOOGLE_PLACES_API_KEY is set on the backend (backend/app/places.py): photo, rating + review count, price, open/closes time, Google Maps link, 2 AI-suggested dishes per place (Google has no menus). Without the key it falls back to OpenStreetMap. pytest 32/32. Not deployed yet, key not set yet.
