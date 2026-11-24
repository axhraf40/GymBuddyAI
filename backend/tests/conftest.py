import os
import sys
from pathlib import Path

# Tests always run offline with the mock LLM and a throwaway SQLite DB
os.environ["LLM_PROVIDER"] = "mock"
os.environ["DATABASE_URL"] = "sqlite:///./test_gymbuddy.db"
os.environ["AUTOMATION_API_KEY"] = "test-key"

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402


@pytest.fixture(scope="session")
def client():
    from app.db import engine
    from app.main import app

    with TestClient(app) as c:
        yield c
    engine.dispose()
    Path("test_gymbuddy.db").unlink(missing_ok=True)


@pytest.fixture
def user(client):
    r = client.post("/api/users", json={
        "name": "Test", "email": "test@example.com", "daily_digest": True,
        "profile": {"age": 22, "sex": "male", "height_cm": 178, "weight_kg": 75, "activity": "moderate",
                    "goal": "build_muscle", "experience": "beginner", "days_per_week": 3, "equipment": "dumbbells",
                    "diet": "halal", "allergies": ["peanuts"], "injuries": ["knee"]},
    })
    assert r.status_code == 200
    return r.json()
