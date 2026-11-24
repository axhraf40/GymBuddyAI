"""GymBuddy AI - FastAPI application (REST API used by the web app and the n8n automation)."""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
import math
import re
import secrets
import time
import unicodedata
from concurrent.futures import ThreadPoolExecutor, as_completed
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone

import httpx
from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from . import chatbot, email_service, llm, retrieval
from . import places as gplaces
from .config import settings
from .db import get_db, init_db
from .models import Conversation, Feedback, Message, User
from .nutrition import compute_targets
from .schemas import (
    AuthGoogle,
    AuthLogin,
    AuthRegister,
    ChatRequest,
    ChatResponse,
    EquipmentIdentifyRequest,
    FeedbackIn,
    ForgotPasswordIn,
    FridgeMealsRequest,
    NearbyRestaurantsRequest,
    PlanUpdate,
    Profile,
    RatingIn,
    ResetPasswordIn,
    UserCreate,
    UserOut,
    VerifyEmailIn,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("gymbuddy")


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    retrieval.index()  # build the BM25 index once at startup
    log.info("GymBuddy API ready (LLM=%s, mock=%s)", llm.provider_label(), llm.is_mock())
    yield


app = FastAPI(title="GymBuddy AI API", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- consistent error format ----------

@app.exception_handler(RequestValidationError)
async def validation_handler(_: Request, exc: RequestValidationError):
    errors = [f"{'.'.join(str(x) for x in e['loc'][1:])}: {e['msg']}" for e in exc.errors()]
    return JSONResponse(status_code=422, content={"error": "invalid_input", "detail": errors})


@app.exception_handler(Exception)
async def unhandled_handler(_: Request, exc: Exception):
    log.exception("Unhandled error: %s", exc)
    return JSONResponse(status_code=500, content={"error": "server_error", "detail": "Something went wrong on our side. Please try again."})


# ---------- helpers ----------

def _hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 120_000)
    return f"{salt}${dk.hex()}"


def _verify_password(password: str, stored: str) -> bool:
    if "$" not in stored:
        return False
    salt, expected = stored.split("$", 1)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 120_000)
    return hmac.compare_digest(dk.hex(), expected)


def _token_secret() -> bytes:
    return (settings.automation_api_key or "gymbuddy-secret").encode("utf-8")


def _sign_user_token(u: User) -> str:
    payload = {
        "id": u.id,
        "username": u.username or "",
        "name": u.name or "",
        "email": u.email or "",
        "password_hash": u.password_hash or "",
        "plan": u.plan or "free",
        "is_verified": int(u.is_verified or 0),
        "daily_digest": int(u.daily_digest or 0),
        "profile": u.profile or {},
    }
    raw = base64.urlsafe_b64encode(json.dumps(payload, separators=(",", ":")).encode("utf-8")).decode("ascii")
    sig = hmac.new(_token_secret(), raw.encode("ascii"), hashlib.sha256).hexdigest()
    return f"{raw}.{sig}"


def _restore_user_from_token(db: Session, token: str | None) -> User | None:
    if not token or "." not in token:
        return None
    raw, sig = token.rsplit(".", 1)
    expected = hmac.new(_token_secret(), raw.encode("ascii"), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(sig, expected):
        return None
    try:
        data = json.loads(base64.urlsafe_b64decode(raw.encode("ascii")).decode("utf-8"))
    except Exception:
        return None
    uid = data.get("id")
    if not uid:
        return None
    u = db.get(User, uid)
    if not u and data.get("email"):
        u = db.scalars(select(User).where(User.email == data["email"])).first()
    if not u:
        u = User(
            id=uid,
            username=data.get("username", ""),
            name=data.get("name", ""),
            email=data.get("email", ""),
            password_hash=data.get("password_hash", ""),
            plan=data.get("plan", "free"),
            is_verified=int(data.get("is_verified", 0)),
            daily_digest=int(data.get("daily_digest", 0)),
            profile=data.get("profile") or {},
        )
        db.add(u)
        db.commit()
    elif data.get("password_hash") and not u.password_hash:
        u.password_hash = data["password_hash"]
        db.commit()
    return u


def _restore_vault(db: Session, tokens: list[str] | None) -> None:
    for t in (tokens or [])[:30]:
        _restore_user_from_token(db, t)


@app.middleware("http")
async def restore_auth_token_middleware(request: Request, call_next):
    token = request.headers.get("x-auth-token")
    if token:
        from .db import SessionLocal

        with SessionLocal() as db:
            _restore_user_from_token(db, token)
    return await call_next(request)


def _user_out(u: User) -> UserOut:
    p = Profile(**(u.profile or {}))
    plan = u.plan if u.plan in ("free", "pro") else "free"
    uname = u.username or (u.email.split("@")[0] if u.email else u.name.lower().replace(" ", ""))
    return UserOut(
        user_id=u.id,
        username=uname,
        name=u.name,
        email=u.email,
        avatar_url=u.avatar_url or "",
        plan=plan,
        is_verified=bool(u.is_verified),
        daily_digest=bool(u.daily_digest),
        profile=p,
        targets=compute_targets(p),
        auth_token=_sign_user_token(u),
    )


def _get_user(db: Session, user_id: str) -> User:
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(status_code=404, detail="User not found. Please complete the onboarding again.")
    return u


# ---------- routes ----------

@app.get("/")
def root():
    return {"name": "GymBuddy AI API", "docs": "/docs", "health": "/api/health"}


@app.get("/api/health")
def health(check_llm: bool = False):
    llm_check = None
    if check_llm and not llm.is_mock():
        t0 = time.perf_counter()
        try:
            text, model = llm.chat_with_model([{"role": "user", "content": "Reply with the single word: OK"}], max_tokens=300)
            llm_check = {"ok": True, "model": model, "sample": text[:40], "ms": int((time.perf_counter() - t0) * 1000)}
        except llm.LLMError as e:
            llm_check = {"ok": False, "error": str(e)[:600], "ms": int((time.perf_counter() - t0) * 1000)}
    return {
        "llm_check": llm_check,
        "llm_fallback_models": llm.candidate_models()[1:],
        "status": "ok",
        "llm_provider": settings.llm_provider,
        "llm_model": settings.llm_model,
        "mock_mode": llm.is_mock(),
        "documents": len(retrieval.all_docs()),
        "time": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/api/models")
def list_models():
    return {
        "provider": settings.llm_provider,
        "default_model": settings.llm_model,
        "models": llm.FREE_OPENROUTER_MODELS,
    }


@app.post("/api/auth/register")
def auth_register(body: AuthRegister, db: Session = Depends(get_db)):
    email = body.email.strip().lower()
    uname = (body.username.strip().lower() or email.split("@")[0]).replace(" ", "")
    existing_email = db.scalars(select(User).where(User.email == email, User.password_hash != "")).first()
    if existing_email:
        raise HTTPException(status_code=409, detail="An account with this email already exists. Please sign in.")
    existing_uname = db.scalars(select(User).where(User.username == uname, User.password_hash != "")).first()
    if existing_uname and existing_uname.email != email:
        raise HTTPException(status_code=409, detail="This username is already taken. Please pick another username.")
    code = f"{secrets.randbelow(900000) + 100000}"
    emailed = email_service.send_verification_code(email, code, purpose="verify")
    u = User(
        username=uname,
        name=body.name.strip() or uname,
        email=email,
        password_hash=_hash_password(body.password),
        plan="free",
        is_verified=0 if emailed else 1,
        reset_code=code if emailed else "",
        reset_expires=(datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat() if emailed else "",
        daily_digest=0,
        profile=body.profile.model_dump(),
    )
    db.add(u)
    db.commit()
    out = _user_out(u).model_dump()
    out["verification_required"] = emailed
    out["email_sent"] = emailed
    return out


@app.post("/api/auth/verify-email", response_model=UserOut)
def auth_verify_email(body: VerifyEmailIn, db: Session = Depends(get_db)):
    email = body.email.strip().lower()
    u = db.scalars(select(User).where(User.email == email)).first()
    if not u or not u.reset_code or not hmac.compare_digest(u.reset_code, body.code.strip()):
        raise HTTPException(status_code=400, detail="Invalid verification code.")
    if u.reset_expires:
        try:
            if datetime.now(timezone.utc) > datetime.fromisoformat(u.reset_expires):
                raise HTTPException(status_code=400, detail="Verification code expired.")
        except ValueError:
            pass
    u.is_verified = 1
    u.reset_code = ""
    u.reset_expires = ""
    db.commit()
    return _user_out(u)


@app.post("/api/auth/login", response_model=UserOut)
def auth_login(body: AuthLogin, db: Session = Depends(get_db)):
    _restore_vault(db, body.vault_tokens)
    ident = body.email.strip().lower()
    u = db.scalars(
        select(User).where(
            or_(User.email == ident, User.username == ident),
            User.password_hash != "",
        )
    ).first()
    if not u or not _verify_password(body.password, u.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email/username or password.")
    return _user_out(u)


@app.post("/api/auth/google")
def auth_google(body: AuthGoogle, db: Session = Depends(get_db)):
    """Sign in or create an account via Google OAuth token or Google Account Chooser."""
    _restore_vault(db, body.vault_tokens)
    email = body.email.strip().lower()
    name = body.name.strip()
    avatar = body.avatar_url

    if not body.access_token and not body.id_token:
        # SECURITY: never trust a typed-in email without a Google-signed token
        raise HTTPException(status_code=401, detail="Google sign-in requires a verified Google token.")

    if body.access_token:
        try:
            r = httpx.get(
                "https://www.googleapis.com/oauth2/v3/userinfo",
                headers={"Authorization": f"Bearer {body.access_token}"},
                timeout=10,
            )
            if r.status_code != 200:
                raise HTTPException(status_code=401, detail="Google access token verification failed.")
            info = r.json()
            email = (info.get("email") or "").strip().lower()
            name = (info.get("name") or name or email.split("@")[0].title()).strip()
            avatar = info.get("picture") or avatar
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(status_code=401, detail="Could not verify Google account.")
    if body.id_token:
        try:
            r = httpx.get(
                "https://oauth2.googleapis.com/tokeninfo",
                params={"id_token": body.id_token},
                timeout=10,
            )
            if r.status_code != 200:
                raise HTTPException(status_code=401, detail="Google token verification failed.")
            info = r.json()
            if settings.google_client_id and info.get("aud") != settings.google_client_id:
                raise HTTPException(status_code=401, detail="Google token audience mismatch.")
            if str(info.get("email_verified", "true")).lower() != "true":
                raise HTTPException(status_code=401, detail="Your Google email is not verified.")
            email = (info.get("email") or "").strip().lower()
            name = (info.get("name") or name or email.split("@")[0].title()).strip()
            avatar = info.get("picture") or avatar
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(status_code=401, detail="Could not verify Google sign-in token.")

    if not email or "@" not in email:
        raise HTTPException(status_code=422, detail="Please choose a valid Google account.")

    uname = email.split("@")[0].lower().replace(" ", "")
    u = db.scalars(select(User).where(User.email == email)).first()
    if not u:
        u = User(
            username=uname,
            name=(name or uname.title()),
            email=email,
            avatar_url=avatar,
            plan="free",
            is_verified=1,
            daily_digest=0,
            profile=Profile().model_dump(),
        )
        db.add(u)
    else:
        if not u.username:
            u.username = uname
        if name and not u.name:
            u.name = name
        if avatar and not u.avatar_url:
            u.avatar_url = avatar
        u.is_verified = 1

    db.commit()
    out = _user_out(u).model_dump()
    out["verification_required"] = False
    return out


@app.post("/api/auth/forgot-password")
def forgot_password(body: ForgotPasswordIn, db: Session = Depends(get_db)):
    """Generate and email a 6-digit password reset code valid for 15 minutes."""
    _restore_vault(db, body.vault_tokens)
    ident = body.email.strip().lower()
    u = db.scalars(select(User).where(or_(User.email == ident, User.username == ident))).first()
    if not u:
        raise HTTPException(status_code=404, detail="No account found with this email or username.")
    code = f"{secrets.randbelow(900000) + 100000}"
    u.reset_code = code
    u.reset_expires = (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()
    db.commit()
    emailed = email_service.send_verification_code(u.email, code, purpose="reset")
    resp: dict = {
        "ok": True,
        "email_sent": emailed,
        "message": (
            f"A 6-digit verification code was sent to {u.email} (valid 15 min)."
            if emailed
            else "A 6-digit verification code has been generated (valid 15 min)."
        ),
    }
    if not emailed:
        resp["verification_code"] = code
    return resp


@app.post("/api/auth/reset-password")
def reset_password(body: ResetPasswordIn, db: Session = Depends(get_db)):
    _restore_vault(db, body.vault_tokens)
    ident = body.email.strip().lower()
    u = db.scalars(select(User).where(or_(User.email == ident, User.username == ident))).first()
    if not u or not u.reset_code or not hmac.compare_digest(u.reset_code, body.code.strip()):
        raise HTTPException(status_code=400, detail="Invalid verification code.")
    if u.reset_expires:
        try:
            exp = datetime.fromisoformat(u.reset_expires)
            if datetime.now(timezone.utc) > exp:
                raise HTTPException(status_code=400, detail="Verification code expired. Please request a new one.")
        except ValueError:
            pass
    u.password_hash = _hash_password(body.new_password)
    u.reset_code = ""
    u.reset_expires = ""
    db.commit()
    return {"ok": True, "message": "Password updated! You can now sign in.", "auth_token": _sign_user_token(u)}


MEAL_ADDONS = [
    {"id": "add_chicken", "name": "+100g Grilled Chicken Breast", "kcal": 165, "protein": 31, "carbs": 0, "fat": 3.6, "price_usd": 0.75, "allergens": [], "tags": ["halal"]},
    {"id": "add_eggs", "name": "+2 Boiled Eggs", "kcal": 144, "protein": 12.6, "carbs": 0.8, "fat": 9.6, "price_usd": 0.50, "allergens": ["egg"], "tags": ["halal", "vegetarian"]},
    {"id": "add_avocado", "name": "+Half Avocado (75g)", "kcal": 120, "protein": 1.5, "carbs": 6.5, "fat": 11.2, "price_usd": 0.70, "allergens": [], "tags": ["halal", "vegetarian", "vegan"]},
    {"id": "add_rice", "name": "+100g Cooked Rice", "kcal": 130, "protein": 2.7, "carbs": 28, "fat": 0.3, "price_usd": 0.25, "allergens": [], "tags": ["halal", "vegetarian", "vegan"]},
    {"id": "add_whey", "name": "+1 Scoop Whey Protein", "kcal": 120, "protein": 24, "carbs": 3, "fat": 1.5, "price_usd": 0.95, "allergens": ["dairy"], "tags": ["halal", "vegetarian"]},
    {"id": "add_yogurt", "name": "+150g Greek Yogurt 0%", "kcal": 89, "protein": 15, "carbs": 5.4, "fat": 0.6, "price_usd": 0.85, "allergens": ["dairy"], "tags": ["halal", "vegetarian"]},
    {"id": "add_olive_oil", "name": "+1 tbsp Extra Virgin Olive Oil", "kcal": 119, "protein": 0, "carbs": 0, "fat": 13.5, "price_usd": 0.20, "allergens": [], "tags": ["halal", "vegetarian", "vegan"]},
    {"id": "add_almonds", "name": "+30g Roasted Almonds", "kcal": 173, "protein": 6.3, "carbs": 6.5, "fat": 15, "price_usd": 0.55, "allergens": ["tree_nuts"], "tags": ["halal", "vegetarian", "vegan"]},
    {"id": "add_dates", "name": "+2 Medjool Dates", "kcal": 132, "protein": 0.8, "carbs": 36, "fat": 0, "price_usd": 0.45, "allergens": [], "tags": ["halal", "vegetarian", "vegan"]},
]

CURRENCIES = [
    {"code": "MAD", "symbol": "MAD", "label": "Morocco (MAD)", "rate": 10.0},
    {"code": "USD", "symbol": "$", "label": "United States (USD)", "rate": 1.0},
    {"code": "EUR", "symbol": "€", "label": "Europe (EUR)", "rate": 0.92},
    {"code": "GBP", "symbol": "£", "label": "United Kingdom (GBP)", "rate": 0.79},
    {"code": "SAR", "symbol": "SAR", "label": "Saudi Arabia (SAR)", "rate": 3.75},
    {"code": "AED", "symbol": "AED", "label": "UAE (AED)", "rate": 3.67},
    {"code": "CAD", "symbol": "CA$", "label": "Canada (CAD)", "rate": 1.38},
]


@app.get("/api/nutrition/overview")
def nutrition_overview(user_id: str | None = None, db: Session = Depends(get_db)):
    """Return personalized macro targets + allergen/diet-filtered recipes, add-ons, currencies & foods."""
    profile = Profile(**(_get_user(db, user_id).profile or {})) if user_id else Profile()
    targets = compute_targets(profile)
    allergies = {a.lower() for a in profile.allergies}

    def safe(item: dict) -> bool:
        if allergies and (set(item.get("allergens", [])) & allergies):
            return False
        tags = set(item.get("tags", []))
        if profile.diet == "vegan" and "vegan" not in tags:
            return False
        if profile.diet == "vegetarian" and not ({"vegetarian", "vegan"} & tags):
            return False
        return True

    recs = [r for r in retrieval.recipes() if safe(r)]
    foods = [f for f in retrieval.foods() if safe(f)]
    addons = [a for a in MEAL_ADDONS if safe(a)]
    return {
        "targets": targets.model_dump(),
        "diet": profile.diet,
        "allergies": profile.allergies,
        "recipes": recs,
        "foods": foods,
        "addons": addons,
        "currencies": CURRENCIES,
    }


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return round(2 * r * math.asin(math.sqrt(a)), 2)


# (keywords, dish for lose_fat, dish otherwise, kcal lose_fat, kcal other, protein g)
_DISH_RULES: list[tuple[tuple[str, ...], str, str, int, int, int]] = [
    (("moroccan", "tajine", "arab", "lebanese", "syrian", "mediterranean", "turkish", "greek", "kebab", "shawarma", "middle eastern"),
     "Grilled chicken brochettes + big salad, bread on the side", "Chicken tajine with vegetables + grilled chicken skewers", 510, 650, 46),
    (("poke", "sushi", "japanese"), "Salmon or tuna poke bowl, light sauce, extra edamame", "Double-fish poke bowl with rice and edamame", 520, 620, 42),
    (("seafood", "fish"), "Grilled fish with steamed vegetables", "Grilled salmon or sea bass with potatoes and vegetables", 450, 600, 44),
    (("salad", "healthy", "vegan", "vegetarian", "juice", "organic", "bowl"),
     "High-protein salad bowl with grilled chicken or tofu", "Grain bowl with chicken or tofu, avocado and egg", 450, 580, 38),
    (("korean", "thai", "vietnamese", "chinese", "asian", "indian"), "Grilled chicken or tofu with vegetables, steamed rice (half portion)",
     "Chicken stir-fry with vegetables and steamed rice", 500, 640, 40),
    (("mexican", "taco", "burrito"), "Chicken burrito bowl, no sour cream, extra salsa", "Chicken burrito bowl with black beans and rice", 520, 650, 45),
    (("italian", "pizza", "pasta"), "Grilled chicken salad or thin-crust veggie pizza (share half)", "Whole-wheat pasta with grilled chicken and tomato sauce", 540, 680, 38),
    (("burger", "american"), "Grilled chicken burger, no fries, side salad", "Lean beef or grilled chicken burger with side salad", 520, 680, 38),
    (("chicken", "grill", "bbq", "rotisserie", "steak"), "Half grilled chicken (no skin) + salad", "Grilled chicken or steak with rice and vegetables", 480, 650, 50),
    (("cafe", "coffee", "breakfast", "bakery", "brunch"), "Egg-white omelette or eggs with avocado toast", "Eggs, avocado toast and Greek yogurt", 420, 550, 30),
]

# Healthier categories rank first; fried/sugary ones are kept only if nothing better exists
_HEALTHY_WORDS = ("salad", "healthy", "vegan", "vegetarian", "poke", "sushi", "japanese", "seafood", "fish", "mediterranean",
                  "lebanese", "greek", "moroccan", "juice", "organic", "bowl", "grill", "korean", "vietnamese", "thai")
_UNHEALTHY_WORDS = ("burger", "fried", "donut", "doughnut", "ice cream", "dessert", "candy", "waffle", "crepe", "bubble tea",
                    "chicken wings", "pizza", "kfc", "mcdonald", "burger king", "popeyes", "domino")

OVERPASS_MIRRORS = (
    "https://overpass-api.de/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
)
_OSM_HEADERS = {"User-Agent": "GymBuddyAI/1.1"}


def _suggest_dish_for_cuisine(cuisine: str, diet: str, goal: str) -> dict:
    c = (cuisine or "").lower()
    if diet in ("vegan", "vegetarian"):
        return {"dish": "Chickpea or tofu power bowl with vegetables (dressing on the side)", "kcal": 480, "protein_g": 24 if diet == "vegan" else 28}
    lean = goal == "lose_fat"
    for keys, dish_lean, dish_other, kcal_lean, kcal_other, protein in _DISH_RULES:
        if any(k in c for k in keys):
            return {"dish": dish_lean if lean else dish_other, "kcal": kcal_lean if lean else kcal_other, "protein_g": protein}
    return {
        "dish": "Grilled chicken or fish with vegetables and rice (sauce on the side)",
        "kcal": 520 if lean else 630,
        "protein_g": 44,
    }


def _health_score(name: str, cuisine: str, tags: dict, diet: str) -> int:
    text = f"{name} {cuisine}".lower()
    score = 0
    score += 3 * sum(w in text for w in _HEALTHY_WORDS)
    score -= 4 * sum(w in text for w in _UNHEALTHY_WORDS)
    if tags.get("amenity") == "fast_food":
        score -= 2
    if tags.get("diet:vegan") in ("yes", "only") or tags.get("diet:vegetarian") in ("yes", "only"):
        score += 2
    if diet == "halal" and tags.get("diet:halal") in ("yes", "only"):
        score += 3
    if diet in ("vegan", "vegetarian") and tags.get(f"diet:{diet}") in ("yes", "only"):
        score += 4
    return score


def _latin_prefix(text: str) -> str:
    """Keep the Latin-script part of a place name ("Casablanca ⵜⴰ... الدار" -> "Casablanca")."""
    text = re.split(r"\s{2,}", text.strip())[0]
    for i, ch in enumerate(text):
        if ch.isalpha() and "LATIN" not in unicodedata.name(ch, ""):
            return text[:i].strip(" -,/")
    return text


def _geocode(place: str) -> tuple[float, float, str] | None:
    try:
        r = httpx.get(
            "https://nominatim.openstreetmap.org/search",
            params={"q": place, "format": "json", "limit": 1, "accept-language": "en"},
            headers=_OSM_HEADERS,
            timeout=10,
        )
        g = r.json() if r.status_code == 200 else []
        if g:
            name = g[0].get("name") or (g[0].get("display_name") or place).split(",")[0]
            return float(g[0]["lat"]), float(g[0]["lon"]), _latin_prefix(name) or place
    except Exception as e:
        log.warning("Nominatim lookup failed: %s", e)
    return None


def _overpass_one(url: str, lat: float, lon: float, radius_m: int) -> list[dict] | None:
    """Restaurants/cafes as nodes AND buildings (ways) from one Overpass mirror. None = error or non-200."""
    query = (
        f"[out:json][timeout:8];"
        f"nwr[\"amenity\"~\"^(restaurant|cafe|fast_food|food_court)$\"][\"name\"](around:{radius_m},{lat},{lon});"
        f"out center tags 150;"
    )
    try:
        r = httpx.post(url, data={"data": query}, headers=_OSM_HEADERS, timeout=8)
        if r.status_code != 200:
            log.warning("Overpass %s returned HTTP %s", url, r.status_code)
            return None
        return r.json().get("elements") or []
    except Exception as e:
        log.warning("Overpass %s failed: %s", url, e)
        return None


def _nominatim_places(lat: float, lon: float, radius_m: int) -> list[dict] | None:
    """Fallback when every Overpass mirror is down: Nominatim POI search inside a box around the point."""
    d = radius_m / 111_000
    out: list[dict] = []
    for i, q in enumerate(("restaurant", "cafe", "fast food")):
        if i:
            time.sleep(1)  # Nominatim usage policy: max ~1 request per second
        try:
            r = httpx.get(
                "https://nominatim.openstreetmap.org/search",
                params={"q": q, "format": "jsonv2", "limit": 40, "bounded": 1, "extratags": 1,
                        "viewbox": f"{lon - d},{lat + d},{lon + d},{lat - d}"},
                headers=_OSM_HEADERS, timeout=5,
            )
            if r.status_code != 200:
                continue
            for p in r.json():
                tags = dict(p.get("extratags") or {})
                tags.setdefault("name", p.get("name") or "")
                tags.setdefault("amenity", p.get("type") or "restaurant")
                out.append({"lat": float(p["lat"]), "lon": float(p["lon"]), "tags": tags})
        except Exception as e:
            log.warning("Nominatim POI search failed: %s", e)
    return out or None


_PLACES_CACHE: dict[tuple[float, float, int], tuple[float, list[dict]]] = {}


def _find_places(lat: float, lon: float, radius_m: int) -> list[dict] | None:
    """Ask every Overpass mirror and the Nominatim fallback at the same time; return the first good answer.
    Overpass answers are preferred (richer tags); Nominatim is used if no mirror answers within ~9 s."""
    key = (round(lat, 3), round(lon, 3), radius_m)
    hit = _PLACES_CACHE.get(key)
    if hit and time.time() - hit[0] < 1800:
        return hit[1]
    pool = ThreadPoolExecutor(max_workers=len(OVERPASS_MIRRORS) + 1)
    futures = [pool.submit(_overpass_one, url, lat, lon, radius_m) for url in OVERPASS_MIRRORS]
    nomi = pool.submit(_nominatim_places, lat, lon, radius_m)
    result = None
    try:
        for f in as_completed(futures, timeout=9):
            r = f.result()
            if r is not None:
                result = r
                break
    except Exception:
        pass  # timeout: fall back to Nominatim
    if result is None:
        try:
            result = nomi.result(timeout=12)
        except Exception:
            result = None
    pool.shutdown(wait=False, cancel_futures=True)
    if result is not None:
        _PLACES_CACHE[key] = (time.time(), result)
    return result


def _google_restaurants(body: NearbyRestaurantsRequest, profile: Profile) -> dict | None:
    """Real Google Maps data (photo, rating, opening hours) + AI dish suggestions. None -> use OpenStreetMap."""
    found = gplaces.search(body.lat, body.lon, body.city.strip())
    if found is None:
        return None
    ai_dishes = gplaces.suggest_dishes(found[:10], profile.goal, profile.diet, profile.allergies)
    out = []
    for p in found:
        if p["lat"] is None or p["lon"] is None:
            continue
        label = f"{p['cuisine']} {' '.join(p['types'])}".replace("_", " ")
        score = _health_score(p["name"], label, {"diet:vegetarian": "yes" if p["vegetarian"] else ""}, profile.diet)
        dishes = ai_dishes.get(p["place_id"]) or []
        if not dishes:
            s = _suggest_dish_for_cuisine(f"{label} {p['name']}", profile.diet, profile.goal)
            dishes = [{"dish": s["dish"], "kcal": s["kcal"], "protein_g": s["protein_g"], "tip": ""}]
        dist = _haversine_km(body.lat, body.lon, p["lat"], p["lon"]) if body.lat is not None and body.lon is not None else None
        out.append({
            "name": p["name"],
            "cuisine": p["cuisine"],
            "distance_km": dist,
            "address": p["address"] or "Nearby",
            "maps_url": p["maps_url"] or f"https://www.google.com/maps/search/?api=1&query={p['lat']},{p['lon']}",
            "recommended_dish": dishes[0]["dish"],
            "est_kcal": dishes[0]["kcal"] or 0,
            "est_protein_g": dishes[0]["protein_g"] or 0,
            "dishes": dishes,
            "health_score": score,
            "healthy_pick": score >= 3,
            "badges": ["Vegetarian options"] if p["vegetarian"] else [],
            "photo_url": f"/api/restaurants/photo?ref={p['photo_ref']}" if p["photo_ref"] else "",
            "rating": p["rating"],
            "rating_count": p["rating_count"],
            "price": p["price"],
            "open_now": p["open_now"],
            "hours_text": p["hours_text"],
            "summary": p["summary"],
            "source": "google",
        })
    # Open places first, then healthier, then better rated, then closer
    out.sort(key=lambda x: (x["open_now"] is False, -min(x["health_score"], 6), -(x["rating"] or 0), x["distance_km"] or 0))
    return {
        "location": body.city.strip() or (f"{body.lat:.3f}, {body.lon:.3f}" if body.lat is not None else ""),
        "radius_km": 3.0,
        "count": len(out[:12]),
        "restaurants": out[:12],
        "source": "google",
    }


@app.get("/api/restaurants/photo")
def restaurant_photo(ref: str):
    """Redirect to a Google Places photo without exposing the API key to the browser."""
    uri = gplaces.photo_url(ref) if gplaces.enabled() else ""
    if not uri:
        raise HTTPException(status_code=404, detail="Photo not available")
    return RedirectResponse(uri, status_code=302, headers={"Cache-Control": "public, max-age=3600"})


@app.post("/api/restaurants/nearby")
def nearby_restaurants(body: NearbyRestaurantsRequest, db: Session = Depends(get_db)):
    """Find real nearby restaurants with OpenStreetMap (Overpass + Nominatim), rank the healthiest first and
    suggest a dish that fits the user's goal and diet."""
    profile = Profile(**(_get_user(db, body.user_id).profile or {})) if body.user_id else Profile()
    if gplaces.enabled():
        g = _google_restaurants(body, profile)
        if g is not None:
            return g
    lat, lon = body.lat, body.lon
    resolved_location = body.city.strip()

    if (lat is None or lon is None) and resolved_location:
        geo = _geocode(resolved_location)
        if not geo:
            raise HTTPException(status_code=404, detail=f"Could not find \"{resolved_location}\". Try another city or neighbourhood name.")
        lat, lon, resolved_location = geo

    if lat is None or lon is None:
        raise HTTPException(status_code=422, detail="Please share your GPS location or enter a city name.")

    radius_used = 2000
    elements = _find_places(lat, lon, radius_used)
    if elements is None:
        raise HTTPException(
            status_code=503,
            detail="The restaurant map service (OpenStreetMap) is busy right now. Please try again in a minute.",
        )

    places = []
    seen: set[str] = set()
    for el in elements:
        tags = el.get("tags") or {}
        name = (tags.get("name") or "").strip()
        plat = el.get("lat") or (el.get("center") or {}).get("lat")
        plon = el.get("lon") or (el.get("center") or {}).get("lon")
        if not name or plat is None or plon is None or name.lower() in seen:
            continue
        seen.add(name.lower())
        cuisine = (tags.get("cuisine") or tags.get("amenity") or "restaurant").replace(";", ", ").replace("_", " ")
        score = _health_score(name, cuisine, tags, profile.diet)
        suggestion = _suggest_dish_for_cuisine(f"{cuisine} {name}", profile.diet, profile.goal)
        addr = " ".join(filter(None, [tags.get("addr:street"), tags.get("addr:housenumber"), tags.get("addr:city")]))
        badges = [label for key, label in (("diet:halal", "Halal"), ("diet:vegetarian", "Vegetarian"), ("diet:vegan", "Vegan"))
                  if tags.get(key) in ("yes", "only")]
        places.append({
            "name": name,
            "cuisine": cuisine.title(),
            "distance_km": _haversine_km(lat, lon, plat, plon),
            "address": addr or "Nearby",
            "maps_url": f"https://www.google.com/maps/search/?api=1&query={plat},{plon}",
            "recommended_dish": suggestion["dish"],
            "est_kcal": suggestion["kcal"],
            "est_protein_g": suggestion["protein_g"],
            "health_score": score,
            "healthy_pick": score >= 3,
            "badges": badges,
        })

    # Healthiest first, then closest; drop clearly unhealthy spots when there are enough good options
    good = [p for p in places if p["health_score"] >= 0]
    pool = good if len(good) >= 5 else places
    pool.sort(key=lambda x: (-min(x["health_score"], 6), x["distance_km"]))
    top = pool[:12]
    return {
        "location": resolved_location or f"{lat:.3f}, {lon:.3f}",
        "radius_km": radius_used / 1000,
        "count": len(top),
        "restaurants": top,
    }


@app.post("/api/nutrition/fridge-meals")
def generate_fridge_meals(body: FridgeMealsRequest, db: Session = Depends(get_db)):
    """Generate step-by-step meals from home ingredients + generate a dish photo via Recraft."""
    profile = Profile(**(_get_user(db, body.user_id).profile or {})) if body.user_id else Profile()
    return chatbot.fridge_meals(body.ingredients.strip(), profile, body.currency_code)


@app.post("/api/users/{user_id}/plan", response_model=UserOut)
def set_user_plan(user_id: str, body: PlanUpdate, db: Session = Depends(get_db)):
    u = _get_user(db, user_id)
    u.plan = body.plan
    db.commit()
    return _user_out(u)


WORKOUT_SPLITS: dict[str, tuple[str, list[str]]] = {
    "push": ("PPL — Push Day (Chest, Shoulders, Triceps)", ["chest", "chest", "shoulders", "shoulders", "triceps"]),
    "pull": ("PPL — Pull Day (Back, Traps, Biceps)", ["upper_back", "upper_back", "traps", "biceps", "forearms"]),
    "legs": ("PPL — Leg Day (Quads, Hamstrings, Glutes, Calves)", ["quads", "quads", "hamstrings", "glutes", "calves"]),
    "upper": ("Upper / Lower — Upper Body", ["chest", "upper_back", "shoulders", "biceps", "triceps"]),
    "lower": ("Upper / Lower — Lower Body & Core", ["quads", "hamstrings", "glutes", "calves", "abs"]),
    "full_body": ("Full Body Session", ["quads", "chest", "upper_back", "shoulders", "hamstrings", "abs"]),
    "arnold_chest_back": ("Arnold Split — Chest & Back", ["chest", "upper_back", "chest", "upper_back", "lower_back"]),
    "arnold_shoulders_arms": ("Arnold Split — Shoulders & Arms", ["shoulders", "shoulders", "biceps", "triceps", "forearms"]),
    "bro_chest": ("Bro Split — Chest Day", ["chest", "chest", "chest", "abs"]),
    "bro_back": ("Bro Split — Back Day", ["upper_back", "upper_back", "traps", "lower_back"]),
    "bro_shoulders": ("Bro Split — Shoulders Day", ["shoulders", "shoulders", "shoulders", "traps"]),
    "bro_arms": ("Bro Split — Arms Day (Biceps, Triceps, Forearms)", ["biceps", "triceps", "biceps", "triceps", "forearms"]),
    "phul_upper_power": ("PHUL — Upper Power", ["chest", "upper_back", "shoulders", "biceps", "triceps"]),
    "phul_lower_power": ("PHUL — Lower Power", ["quads", "lower_back", "hamstrings", "glutes", "calves"]),
    "glutes_abs": ("Glutes, Legs & Core Focus", ["glutes", "glutes", "hamstrings", "abs", "obliques"]),
}


@app.get("/api/workouts/session")
def get_workout_session(split: str = "push", user_id: str | None = None, db: Session = Depends(get_db)):
    """Build a ready-to-run gym session with alternatives for 'Equipment Busy -> Swap'."""
    key = split.lower() if split.lower() in WORKOUT_SPLITS else "push"
    title, muscle_seq = WORKOUT_SPLITS[key]
    profile = Profile(**(_get_user(db, user_id).profile or {})) if user_id else Profile()

    used_ids: set[str] = set()
    items = []
    for m_id in muscle_seq:
        cands = retrieval.exercises_for(m_id, profile.equipment if user_id else None, profile.injuries)
        pick = next((e for e in cands if e["id"] not in used_ids), cands[0] if cands else None)
        if not pick:
            continue
        used_ids.add(pick["id"])
        alts = [
            {
                "id": a["id"], "name": a["name"], "muscle": a["muscle"],
                "sets": 3, "target_reps": "10-12", "rest_sec": 75,
                "gif_url": a.get("gif_url", ""), "image_url": a.get("image_url", ""),
                "tips": a.get("tips", ""), "equipment": a.get("equipment", []),
            }
            for a in cands if a["id"] != pick["id"]
        ][:3]
        is_compound = any(k in pick["name"].lower() for k in ("squat", "bench", "deadlift", "press", "pull-up", "row", "thrust"))
        is_timed = any(k in pick["name"].lower() for k in ("plank", "hang", "carry"))
        items.append({
            "id": pick["id"],
            "name": pick["name"],
            "muscle": pick["muscle"],
            "muscle_name": retrieval.muscle_names().get(pick["muscle"], pick["muscle"]),
            "sets": 4 if is_compound and profile.experience != "beginner" else 3,
            "target_reps": "45 s" if is_timed else ("8-10" if is_compound else "10-15"),
            "is_timed": is_timed,
            "timed_sec": 45 if is_timed else 0,
            "rest_sec": 120 if is_compound else 75,
            "default_weight_kg": 0 if ("bodyweight" in pick["equipment"] and profile.equipment == "bodyweight") else (40 if is_compound else 12),
            "gif_url": pick.get("gif_url", ""),
            "image_url": pick.get("image_url", ""),
            "tips": pick.get("tips", ""),
            "injury_warning": pick.get("injury_warning", []),
            "alternatives": alts,
        })

    return {
        "split": key,
        "title": title,
        "available_splits": [{"id": k, "title": v[0]} for k, v in WORKOUT_SPLITS.items()],
        "exercises": items,
    }


@app.post("/api/users", response_model=UserOut)
def create_user(body: UserCreate, db: Session = Depends(get_db)):
    u = User(
        name=body.name.strip(), email=body.email.strip(), avatar_url=body.avatar_url,
        daily_digest=int(body.daily_digest), profile=body.profile.model_dump(),
    )
    db.add(u)
    db.commit()
    return _user_out(u)


@app.get("/api/users/{user_id}", response_model=UserOut)
def get_user(user_id: str, db: Session = Depends(get_db)):
    return _user_out(_get_user(db, user_id))


@app.put("/api/users/{user_id}", response_model=UserOut)
def update_user(user_id: str, body: UserCreate, db: Session = Depends(get_db)):
    u = _get_user(db, user_id)
    u.name, u.email, u.daily_digest = body.name.strip(), body.email.strip(), int(body.daily_digest)
    if body.avatar_url is not None:
        u.avatar_url = body.avatar_url
    u.profile = body.profile.model_dump()
    db.commit()
    return _user_out(u)


@app.get("/api/muscles")
def list_muscles():
    counts: dict[str, int] = {}
    for e in retrieval.exercises():
        counts[e["muscle"]] = counts.get(e["muscle"], 0) + 1
    return [{"id": m["id"], "name": m["name"], "view": m["view"], "exercise_count": counts.get(m["id"], 0)} for m in retrieval.muscles()]


@app.get("/api/muscles/{muscle_id}/exercises")
def muscle_exercises(muscle_id: str, user_id: str | None = None, db: Session = Depends(get_db)):
    if muscle_id not in retrieval.muscle_names():
        raise HTTPException(status_code=404, detail=f"Unknown muscle '{muscle_id}'")
    profile = Profile(**(_get_user(db, user_id).profile or {})) if user_id else Profile()
    return {
        "muscle": {"id": muscle_id, "name": retrieval.muscle_names()[muscle_id]},
        "exercises": retrieval.exercises_for(muscle_id, profile.equipment if user_id else None, profile.injuries),
        "suggestions": chatbot.suggestions_for(muscle_id, profile),
    }


@app.post("/api/chat", response_model=ChatResponse)
def chat(body: ChatRequest, db: Session = Depends(get_db)):
    user = _get_user(db, body.user_id)
    profile = Profile(**(user.profile or {}))

    if body.conversation_id:
        conv = db.get(Conversation, body.conversation_id)
        if not conv or conv.user_id != user.id:
            raise HTTPException(status_code=404, detail="Conversation not found")
    else:
        title = body.message.strip().replace("\n", " ")
        conv = Conversation(user_id=user.id, title=(title[:57] + "...") if len(title) > 60 else title)
        db.add(conv)
        db.flush()

    history = [{"role": m.role, "content": m.content} for m in conv.messages]
    result = chatbot.answer(body.message.strip(), profile, history, body.muscle, model_override=body.model)

    db.add(Message(conversation_id=conv.id, role="user", content=body.message.strip(), muscle=body.muscle))
    bot_msg = Message(
        conversation_id=conv.id, role="assistant", content=result.reply, muscle=result.muscle,
        sources=result.sources, flags=result.flags, latency_ms=result.latency_ms, provider=result.provider,
    )
    db.add(bot_msg)
    conv.updated_at = datetime.now(timezone.utc)
    db.commit()
    log.info("chat user=%s conv=%s provider=%s flags=%s latency=%dms", user.id[:8], conv.id[:8], result.provider, result.flags, result.latency_ms)

    return ChatResponse(
        conversation_id=conv.id, message_id=bot_msg.id, reply=result.reply, sources=result.sources,
        flags=result.flags, suggestions=result.suggestions, generated_image_url=result.generated_image_url,
        provider=result.provider, latency_ms=result.latency_ms,
    )


@app.post("/api/equipment/identify", response_model=ChatResponse)
def identify_equipment(body: EquipmentIdentifyRequest, db: Session = Depends(get_db)):
    user = _get_user(db, body.user_id)
    profile = Profile(**(user.profile or {}))

    if body.conversation_id:
        conv = db.get(Conversation, body.conversation_id)
        if not conv or conv.user_id != user.id:
            raise HTTPException(status_code=404, detail="Conversation not found")
    else:
        title_map = {"food": "🍽️ Meal photo scan", "barcode": "🏷️ Barcode / Yuka scan", "equipment": "📷 Equipment scan"}
        conv = Conversation(user_id=user.id, title=title_map.get(body.scan_mode, "📷 Smart AI photo scan"))
        db.add(conv)
        db.flush()

    result = chatbot.identify_equipment(
        body.image_data_url,
        body.question.strip(),
        profile,
        scan_mode=body.scan_mode,
        barcode=body.barcode,
    )
    user_label = f"🏷️ [Barcode {body.barcode}]" if body.barcode else f"📷 [{body.scan_mode.upper()} photo] {body.question.strip() or 'Analyze this image'}"
    db.add(Message(conversation_id=conv.id, role="user", content=user_label))
    bot_msg = Message(
        conversation_id=conv.id, role="assistant", content=result.reply, muscle=result.muscle,
        sources=result.sources, flags=result.flags, latency_ms=result.latency_ms, provider=result.provider,
    )
    db.add(bot_msg)
    conv.updated_at = datetime.now(timezone.utc)
    db.commit()
    log.info("vision_scan mode=%s user=%s provider=%s gifs=%d latency=%dms", body.scan_mode, user.id[:8], result.provider, len(result.matched_exercises), result.latency_ms)

    return ChatResponse(
        conversation_id=conv.id, message_id=bot_msg.id, reply=result.reply, sources=result.sources,
        flags=result.flags, suggestions=result.suggestions, matched_exercises=result.matched_exercises,
        provider=result.provider, latency_ms=result.latency_ms,
    )


@app.get("/api/users/{user_id}/conversations")
def list_conversations(user_id: str, db: Session = Depends(get_db)):
    _get_user(db, user_id)
    convs = db.scalars(select(Conversation).where(Conversation.user_id == user_id).order_by(Conversation.updated_at.desc())).all()
    return [{"id": c.id, "title": c.title, "updated_at": c.updated_at.isoformat()} for c in convs]


@app.get("/api/conversations/{conversation_id}/messages")
def conversation_messages(conversation_id: str, user_id: str, db: Session = Depends(get_db)):
    conv = db.get(Conversation, conversation_id)
    if not conv or conv.user_id != user_id:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return [
        {"id": m.id, "role": m.role, "content": m.content, "muscle": m.muscle, "sources": m.sources,
         "flags": m.flags, "rating": m.rating, "provider": m.provider or "", "created_at": m.created_at.isoformat()}
        for m in conv.messages
    ]


@app.delete("/api/conversations/{conversation_id}")
def delete_conversation(conversation_id: str, user_id: str, db: Session = Depends(get_db)):
    conv = db.get(Conversation, conversation_id)
    if not conv or conv.user_id != user_id:
        raise HTTPException(status_code=404, detail="Conversation not found")
    db.delete(conv)
    db.commit()
    return {"ok": True}


@app.post("/api/messages/{message_id}/rating")
def rate_message(message_id: str, body: RatingIn, db: Session = Depends(get_db)):
    m = db.get(Message, message_id)
    if not m or m.role != "assistant":
        raise HTTPException(status_code=404, detail="Message not found")
    m.rating = body.rating
    db.commit()
    return {"ok": True}


@app.post("/api/feedback")
def send_feedback(body: FeedbackIn, db: Session = Depends(get_db)):
    fb = Feedback(user_id=body.user_id, kind=body.kind, text=body.text.strip(), page=body.page)
    db.add(fb)
    db.commit()
    log.warning("FEEDBACK [%s] %s", body.kind, body.text[:200])
    return {"ok": True, "id": fb.id}


# ---------- admin / automation (protected by API key) ----------

def _check_key(x_api_key: str | None):
    if not x_api_key or x_api_key != settings.automation_api_key:
        raise HTTPException(status_code=401, detail="Invalid or missing X-API-Key")


@app.get("/api/automation/daily-digest")
def daily_digest(x_api_key: str | None = Header(default=None), db: Session = Depends(get_db)):
    _check_key(x_api_key)
    users = db.scalars(select(User).where(User.daily_digest == 1)).all()
    return {
        "date": datetime.now(timezone.utc).date().isoformat(),
        "count": len(users),
        "users": [
            {"user_id": u.id, "email": u.email, "plan": u.plan or "free", **chatbot.daily_message(Profile(**(u.profile or {})), u.name)}
            for u in users if u.email
        ],
    }


@app.get("/api/admin/stats")
def admin_stats(x_api_key: str | None = Header(default=None), db: Session = Depends(get_db)):
    """Usage numbers for the report (step 6): messages, ratings, flags, latency, feedback."""
    _check_key(x_api_key)
    msgs = db.scalars(select(Message).where(Message.role == "assistant")).all()
    flags: dict[str, int] = {}
    for m in msgs:
        for f in m.flags or []:
            flags[f] = flags.get(f, 0) + 1
    rated = [m.rating for m in msgs if m.rating]
    return {
        "users": len(db.scalars(select(User)).all()),
        "assistant_messages": len(msgs),
        "thumbs_up": sum(1 for r in rated if r > 0),
        "thumbs_down": sum(1 for r in rated if r < 0),
        "avg_latency_ms": round(sum(m.latency_ms for m in msgs) / len(msgs)) if msgs else 0,
        "flags": flags,
        "feedback": [{"kind": f.kind, "text": f.text, "page": f.page, "created_at": f.created_at.isoformat()}
                     for f in db.scalars(select(Feedback).order_by(Feedback.created_at.desc())).all()],
    }
