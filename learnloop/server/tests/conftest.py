import os
import sys
import uuid
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ.setdefault("APP_ENV", "test")

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import delete, text  # noqa: E402

from app.core.config import get_settings  # noqa: E402
from app.db.session import SessionLocal  # noqa: E402
from app.main import create_app  # noqa: E402
from app.models import User  # noqa: E402


@pytest.fixture()
def client():
    with TestClient(create_app()) as c:
        yield c


@pytest.fixture(scope="session")
def db_ready():
    """Skip DB-backed tests (with the reason) when Supabase isn't reachable or migrated."""
    try:
        with SessionLocal() as db:
            db.execute(text("select version_num from alembic_version"))
    except Exception as exc:  # noqa: BLE001
        pytest.skip(f"Database not reachable/migrated ({type(exc).__name__}). Fix DATABASE_URL, then `npm run db:upgrade`.")


@pytest.fixture()
def make_user(client, db_ready):
    """Register throwaway users through the real API; delete them afterwards."""
    created: list[str] = []

    def _make(password="Sup3rSecret!x"):
        email = f"pytest-{uuid.uuid4().hex[:10]}@example.test"
        r = client.post("/api/v1/auth/register", json={"email": email, "password": password, "display_name": "Test User"})
        assert r.status_code == 201, r.text
        created.append(email)
        return {"email": email, "password": password, **r.json()}

    yield _make
    with SessionLocal() as db:
        db.execute(delete(User).where(User.email.in_(created)))
        db.commit()


@pytest.fixture()
def admin_headers(client, db_ready):
    s = get_settings()
    if not (s.admin_email and s.admin_password):
        pytest.skip("ADMIN_EMAIL/ADMIN_PASSWORD not configured")
    r = client.post("/api/v1/auth/login", json={"email": s.admin_email, "password": s.admin_password})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['tokens']['access_token']}"}


def bearer(auth_response: dict) -> dict:
    return {"Authorization": f"Bearer {auth_response['tokens']['access_token']}"}
