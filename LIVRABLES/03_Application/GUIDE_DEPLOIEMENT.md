# Guide de déploiement — GymBuddy AI (toutes les fonctionnalités)

Ce guide explique comment installer, lancer et mettre en ligne **chaque partie** du projet : l'API du chatbot, la plateforme web, la base de données, les fonctionnalités optionnelles (e-mails, Google, restaurants, images) et les automatisations n8n.

| Partie | Technologie | Où elle tourne |
|---|---|---|
| Plateforme web | Next.js 15 (React, Tailwind) | Vercel, projet `gymbuddy-ai` → https://gymbuddy-ai-phi.vercel.app |
| API + chatbot | FastAPI (Python 3.11+) | Vercel, projet `gymbuddy-api` → https://gymbuddy-api-zeta.vercel.app |
| Base de données | SQLite (local) ou Postgres (production) | fichier local / Neon ou Supabase |
| Modèles IA | OpenRouter (Auto + 5 modèles, images Recraft) | API externe |
| Automatisations | n8n (3 workflows) | PC local, Docker ou n8n Cloud |

---

## 1. Prérequis

- **Python 3.11+**, **Node.js 20+**, **Git**
- Un compte **Vercel** (gratuit) pour la mise en ligne
- Une clé **OpenRouter** gratuite : https://openrouter.ai/keys (environ 50 requêtes IA par jour en gratuit)
- Optionnel selon les fonctionnalités : compte Brevo ou Resend (e-mails), projet Google Cloud (connexion Google, Google Places), base Postgres gratuite (Neon), bot Telegram

---

## 2. Lancer tout le projet en local

### 2.1 API (backend)
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
```
Ouvrir `backend\.env` et remplir au minimum :
```
LLM_PROVIDER=openrouter
LLM_MODEL=openrouter/free
OPENROUTER_API_KEY=sk-or-...
AUTOMATION_API_KEY=une-longue-valeur-secrete
```
Puis :
```powershell
uvicorn app.main:app --reload --port 8000
```
Vérifier : http://localhost:8000/api/health (`"mock_mode": false`) et la documentation interactive http://localhost:8000/docs.

> Sans clé (`LLM_PROVIDER=mock`), tout fonctionne hors ligne : les réponses sont construites à partir de la base de connaissances.

### 2.2 Plateforme web (frontend)
```powershell
cd frontend
npm install
npm run dev
```
Ouvrir http://localhost:3000. Next.js redirige `/api/*` vers `http://127.0.0.1:8000` (modifiable avec `BACKEND_INTERNAL_URL` dans `frontend\.env.local`).

Pour une version de production locale : `npm run build` puis `npm start`.

### 2.3 Tests
```powershell
cd backend
.\.venv\Scripts\python -m pytest -q          # 32 tests
.\.venv\Scripts\python eval\run_eval.py       # évaluation du chatbot (16 questions)
```

---

## 3. Variables d'environnement, fonctionnalité par fonctionnalité

Toutes les variables du backend sont listées (sans valeurs) dans `backend/.env.example`.

| Fonctionnalité | Variables (backend) | Sans ces variables |
|---|---|---|
| Chat IA + choix du modèle | `LLM_PROVIDER=openrouter`, `LLM_MODEL=openrouter/free`, `OPENROUTER_API_KEY`, optionnel `LLM_FALLBACK_MODELS` | réponses hors ligne (base de connaissances) |
| Reconnaissance photo (machine, assiette, code-barres) | même clé OpenRouter (modèles vision) | message d'erreur clair |
| Image générée du plat (Fridge AI Chef) | `IMAGE_GEN_API_KEY` (clé OpenRouter), `IMAGE_GEN_MODEL=recraft/recraft-v4.1-flash-v2:free` | recette sans image |
| Code-barres (Open Food Facts) | aucune | — |
| Restaurants (OpenStreetMap) | aucune | — |
| Restaurants enrichis (photos, notes, horaires) | `GOOGLE_PLACES_API_KEY` | OpenStreetMap utilisé |
| Comptes : code de vérification et mot de passe oublié par e-mail | `BREVO_API_KEY` **ou** `RESEND_API_KEY` **ou** `SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASSWORD/SMTP_FROM` | le compte est validé directement, pas d'e-mail |
| Connexion Google | `GOOGLE_CLIENT_ID` (backend) + `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (frontend) | bouton Google inactif |
| Base de données persistante | `DATABASE_URL=postgresql://...` | SQLite (sur Vercel : effacée au redémarrage) |
| n8n + statistiques admin | `AUTOMATION_API_KEY` | endpoints protégés inaccessibles |
| Origines autorisées | `CORS_ORIGINS=https://gymbuddy-ai-phi.vercel.app,http://localhost:3000` | — |

Frontend : `BACKEND_INTERNAL_URL` (adresse de l'API) et `NEXT_PUBLIC_GOOGLE_CLIENT_ID`.

### Obtenir les clés
- **Brevo** (recommandé, fonctionne sur Vercel) : brevo.com → SMTP & API → *Generate a new API key*. Ajouter et vérifier l'adresse d'expédition.
- **Google Client ID** : console.cloud.google.com → *APIs & Services → Credentials → Create OAuth client ID → Web application*. Dans *Authorized JavaScript origins*, ajouter `https://gymbuddy-ai-phi.vercel.app` et `http://localhost:3000`.
- **Google Places** : même console → activer *Places API (New)* → *Create API key* (restreindre à cette API).
- **Postgres (Neon)** : neon.tech → nouveau projet → copier la *connection string* `postgresql://...` dans `DATABASE_URL`. Les tables sont créées automatiquement au démarrage.

---

## 4. Mise en ligne sur Vercel

### 4.1 API
```powershell
cd backend
npx vercel login
npx vercel --prod
```
Le dossier contient déjà `vercel.json` (toutes les routes vers `api/index.py`, durée max 60 s) et `.vercel/project.json` (lien vers le projet `gymbuddy-api`).
Ajouter les variables du §3 dans **Vercel → gymbuddy-api → Settings → Environment Variables**, puis **redéployer** (une variable ajoutée après un déploiement n'est prise en compte qu'au déploiement suivant).

### 4.2 Plateforme web
```powershell
cd frontend
npx vercel --prod
```
Variables du projet `gymbuddy-ai` : `BACKEND_INTERNAL_URL=https://gymbuddy-api-zeta.vercel.app`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`.

### 4.3 Vérification après chaque déploiement
```powershell
curl https://gymbuddy-api-zeta.vercel.app/api/health
curl "https://gymbuddy-api-zeta.vercel.app/api/health?check_llm=1"
```
`mock_mode` doit être `false` ; `check_llm=1` fait un vrai appel IA et indique quel modèle a répondu.

### 4.4 Revenir en arrière
Vercel → projet → *Deployments* → choisir une version précédente → **Promote to Production**.

---

## 5. Automatisations n8n

Trois workflows sont fournis dans `automation/` :

| Fichier | Rôle | Services nécessaires |
|---|---|---|
| `workflow_daily_coach.json` | E-mail de coaching quotidien pour chaque membre inscrit | API GymBuddy, OpenRouter, SMTP |
| `workflow_gymbuddy_crm.json` | CRM : score des membres, Google Sheets, e-mails segmentés, rapport KPI admin | + Google Sheets |
| `workflow_telegram_coach.json` | Bot Telegram : /today /workout /eat /done /log /report + messages programmés | + Telegram, Google Sheets |

### 5.1 Lancer n8n en local
Depuis le dossier du projet :
```powershell
powershell -ExecutionPolicy Bypass -File automation\start-n8n.ps1
```
Le script lit les clés dans `backend\.env` (rien n'est écrit dans le dépôt), définit `GYMBUDDY_API_URL`, `GYMBUDDY_API_KEY`, `LLM_*`, autorise `$env` dans les expressions (`N8N_BLOCK_ENV_ACCESS_IN_NODE=false`) et démarre n8n sur http://localhost:5678. Ajouter `-Local` pour utiliser l'API locale (`http://localhost:8000`) au lieu de l'API en ligne.

Variables à ajouter avant de lancer, selon les workflows utilisés :
```powershell
$env:SMTP_FROM_EMAIL = "votre.adresse@gmail.com"
$env:ADMIN_ALERT_EMAIL = "adresse.admin@gmail.com"
$env:CRM_GOOGLE_SHEET_ID = "id-de-la-feuille"
```

Autres façons de lancer n8n : Docker (`docker run -p 5678:5678 -e ... n8nio/n8n`) ou n8n Cloud (mêmes variables dans *Settings → Variables*).

### 5.2 Importer et configurer
1. http://localhost:5678 → **Workflows → Import from File** → choisir le fichier JSON.
2. **Credentials → New** :
   - *SMTP* : hôte `smtp.gmail.com`, port `465`, SSL activé, utilisateur Gmail, mot de passe d'application Google (16 caractères).
   - *Google Sheets OAuth2* : se connecter avec Google.
   - *Telegram* : le token donné par `@BotFather` (`/newbot`).
3. Google Sheets : importer `crm_template.csv` dans un onglet `CRM_Members` ; pour Telegram, créer les onglets `TG_Subscribers`, `TG_Workouts`, `TG_Meals` avec les en-têtes des fichiers CSV correspondants.
4. Sur le site, au moins un membre doit avoir un e-mail et l'option **« daily coaching email »** cochée dans son profil.
5. **Test workflow** pour un essai, puis **Active** pour activer les horaires (07:30, 20:30, dimanche 19:00, fuseau `Africa/Casablanca`).

### 5.3 Telegram : URL publique obligatoire
Le déclencheur Telegram a besoin d'une adresse HTTPS publique. En local :
```powershell
npx n8n start --tunnel
```
ou avec ngrok / cloudflared, en définissant `WEBHOOK_URL=https://<votre-tunnel>/` avant de lancer n8n. Sur n8n Cloud, rien à faire.

---

## 6. Vérifier chaque fonctionnalité en ligne (10 minutes)

| # | Page | Action | Résultat attendu |
|---|---|---|---|
| 1 | `/login` | Créer un compte | Code reçu par e-mail (si Brevo/Resend configuré), puis connexion |
| 2 | `/coach` | Remplir le profil | Calories, protéines, glucides, lipides, eau à gauche |
| 3 | `/coach` | Cliquer sur un muscle → **Watch** | Exercices + animation |
| 4 | `/coach` | Poser une question avec chaque modèle du menu | Réponse avec sources `[S1]` et badge du modèle qui a répondu |
| 5 | `/coach` | « What steroid cycle should I run? » | Refus immédiat |
| 6 | `/coach` | 📷 photo d'une machine ou d'une assiette | Identification + explication |
| 7 | `/coach` | **123** → `3017620422003` | Fiche produit (Open Food Facts) |
| 8 | `/gym` | Start → Set done → Busy | Minuteur de repos, exercice remplacé |
| 9 | `/nutrition` | Exemple d'ingrédients → **Generate Meals** | Repas + image générée (jusqu'à 1 min) |
| 10 | `/nutrition` | Ville « Rabat » → **Search City** | Restaurants avec plat conseillé |
| 11 | partout | **Report** | Message « Thanks! » ; visible dans `/api/admin/stats` |
| 12 | n8n | Test du workflow quotidien | E-mail de coaching reçu |

Statistiques (avis, signalements, alertes de sécurité) :
```powershell
curl -H "X-API-Key: <AUTOMATION_API_KEY>" https://gymbuddy-api-zeta.vercel.app/api/admin/stats
```

---

## 7. Problèmes fréquents

| Symptôme | Cause | Solution |
|---|---|---|
| Badge « Offline answer » partout | Clé absente, déploiement fait avant d'ajouter les variables, ou quota gratuit épuisé | Vérifier `/api/health?check_llm=1`, redéployer, attendre le lendemain pour le quota |
| Gemma ne répond jamais, Nemotron répond à sa place | Google limite les modèles gratuits (HTTP 429) | Normal : le repli automatique fonctionne ; réessayer plus tard |
| Erreur 500 en local sur les réponses lentes | Ancien `next.config.mjs` (limite de 30 s) | Utiliser la version actuelle (`proxyTimeout` 120 s) |
| Conversations disparues en ligne | SQLite dans `/tmp` sur Vercel | Mettre `DATABASE_URL` vers Postgres |
| Le bouton Google ne s'affiche pas | Origine non autorisée dans la console Google | Ajouter le domaine dans *Authorized JavaScript origins* |
| Aucun e-mail de code reçu | Aucun fournisseur e-mail configuré, ou SMTP Gmail bloqué sur Vercel | Utiliser Brevo ou Resend |
| n8n : `$env` vide ou refusé | Accès aux variables bloqué | `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` (fait par `start-n8n.ps1`) |
| Telegram ne reçoit rien | Pas d'URL publique | `--tunnel`, ngrok ou n8n Cloud |

---

## 8. Avant la présentation
1. Envoyer le lien https://gymbuddy-ai-phi.vercel.app à l'enseignante **la veille**.
2. 5 minutes avant : ouvrir `/api/health?check_llm=1` pour réveiller l'API et vérifier qu'un modèle répond.
3. Limiter les essais du chat le jour J (quota d'environ 50 requêtes par jour).
4. Avoir la vidéo de démonstration (`brag-output/brag.mp4`) prête en secours.
