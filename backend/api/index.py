"""Vercel Serverless entrypoint for the FastAPI backend."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.db import init_db  # noqa: E402
from app.main import app  # noqa: E402

# Ensure tables exist on cold start (serverless may not always run lifespan before first request)
init_db()
