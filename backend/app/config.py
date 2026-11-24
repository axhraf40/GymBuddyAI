"""Application settings, read from environment variables (and an optional .env file)."""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

DEFAULT_MODELS = {
    "gemini": "gemini-2.0-flash",
    "openrouter": "openrouter/free",
    "mock": "mock-coach",
}


# Tried in order when the main OpenRouter model fails, is rate-limited or returns an empty answer
DEFAULT_OPENROUTER_FALLBACKS = (
    "nvidia/nemotron-3-ultra-550b-a55b:free,nvidia/nemotron-3.5-lightning:free,"
    "google/gemma-4-31b-it:free,google/gemma-4-26b-a4b-it:free"
)


def _int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, default))
    except ValueError:
        return default


def _float(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, default))
    except ValueError:
        return default


@dataclass
class Settings:
    llm_provider: str = field(default_factory=lambda: os.getenv("LLM_PROVIDER", "mock").strip().lower())
    llm_model: str = field(default_factory=lambda: os.getenv("LLM_MODEL", "").strip())
    gemini_api_key: str = field(default_factory=lambda: os.getenv("GEMINI_API_KEY", "").strip())
    openrouter_api_key: str = field(default_factory=lambda: os.getenv("OPENROUTER_API_KEY", "").strip())
    image_gen_api_key: str = field(default_factory=lambda: os.getenv("IMAGE_GEN_API_KEY", "").strip())
    image_gen_model: str = field(
        default_factory=lambda: os.getenv("IMAGE_GEN_MODEL", "recraft/recraft-v4.1-flash-v2:free").strip()
    )
    smtp_host: str = field(default_factory=lambda: os.getenv("SMTP_HOST", "smtp.gmail.com").strip())
    brevo_api_key: str = field(default_factory=lambda: os.getenv("BREVO_API_KEY", "").strip())
    resend_api_key: str = field(default_factory=lambda: os.getenv("RESEND_API_KEY", "").strip())
    smtp_port: int = field(default_factory=lambda: _int("SMTP_PORT", 465))
    smtp_user: str = field(default_factory=lambda: os.getenv("SMTP_USER", "").strip())
    smtp_password: str = field(default_factory=lambda: os.getenv("SMTP_PASSWORD", "").strip())
    smtp_from: str = field(default_factory=lambda: os.getenv("SMTP_FROM", "").strip())
    google_places_api_key: str = field(default_factory=lambda: os.getenv("GOOGLE_PLACES_API_KEY", "").strip().lstrip("\ufeff"))
    google_client_id: str = field(default_factory=lambda: os.getenv("GOOGLE_CLIENT_ID", "").strip())
    llm_temperature: float = field(default_factory=lambda: _float("LLM_TEMPERATURE", 0.4))
    llm_timeout: float = field(default_factory=lambda: _float("LLM_TIMEOUT_SECONDS", 25))
    # Total time allowed for trying the primary model + fallbacks (keep under the host's request limit)
    llm_total_budget: float = field(default_factory=lambda: _float("LLM_TOTAL_BUDGET_SECONDS", 50))
    llm_fallback_models: list[str] = field(
        default_factory=lambda: [
            m.strip() for m in os.getenv("LLM_FALLBACK_MODELS", DEFAULT_OPENROUTER_FALLBACKS).split(",") if m.strip()
        ]
    )
    # Extra tokens granted to reasoning models on top of the answer length
    llm_reasoning_budget: int = field(default_factory=lambda: _int("LLM_REASONING_BUDGET", 1500))
    database_url: str = field(
        default_factory=lambda: os.getenv(
            "DATABASE_URL",
            "sqlite:////tmp/gymbuddy.db" if os.getenv("VERCEL") else "sqlite:///./gymbuddy.db",
        )
    )
    cors_origins: list[str] = field(
        default_factory=lambda: [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",") if o.strip()]
    )
    automation_api_key: str = field(default_factory=lambda: os.getenv("AUTOMATION_API_KEY", "change-me"))
    history_window: int = field(default_factory=lambda: _int("HISTORY_WINDOW", 10))
    retrieval_top_k: int = field(default_factory=lambda: _int("RETRIEVAL_TOP_K", 5))
    max_message_chars: int = 2000

    def __post_init__(self) -> None:
        if self.llm_provider not in DEFAULT_MODELS:
            self.llm_provider = "mock"
        if not self.llm_model:
            self.llm_model = DEFAULT_MODELS[self.llm_provider]
        # Render/Heroku give "postgres://"; SQLAlchemy + psycopg 3 need "postgresql+psycopg://"
        if self.database_url.startswith("postgres://"):
            self.database_url = "postgresql+psycopg://" + self.database_url[len("postgres://"):]
        elif self.database_url.startswith("postgresql://"):
            self.database_url = "postgresql+psycopg://" + self.database_url[len("postgresql://"):]


settings = Settings()
