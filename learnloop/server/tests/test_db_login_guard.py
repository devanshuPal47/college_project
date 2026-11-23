"""The login guard must stop retrying a database login that cannot succeed. No real database needed."""
import psycopg
import pytest
from sqlalchemy.exc import OperationalError

from app.db import session as db_session


@pytest.fixture(autouse=True)
def _reset_guard():
    """Drop pooled connections so every engine.connect() really goes through the guarded connect().
    Without this, a live database lets SQLAlchemy reuse an open connection and these simulations never run
    (and a 'fake failure' test could then write to the real database)."""
    db_session._login_block.update(until=0.0, reason="")
    db_session.engine.dispose()
    yield
    db_session._login_block.update(until=0.0, reason="")
    db_session.engine.dispose()


def test_wrong_password_is_not_retried(monkeypatch):
    calls = []

    def fake_connect(*a, **k):
        calls.append(1)
        raise psycopg.OperationalError('connection failed: FATAL:  password authentication failed for user "postgres"')

    monkeypatch.setattr(psycopg, "connect", fake_connect)
    for _ in range(5):
        with pytest.raises(OperationalError):
            db_session.engine.connect()
    assert len(calls) == 1  # only the first attempt reached the database; the other four failed locally


def test_guard_reports_the_original_reason(monkeypatch):
    monkeypatch.setattr(psycopg, "connect", lambda *a, **k: (_ for _ in ()).throw(psycopg.OperationalError("FATAL:  (ECIRCUITBREAKER) too many authentication failures")))
    with pytest.raises(OperationalError):
        db_session.engine.connect()
    with pytest.raises(OperationalError) as second:
        db_session.engine.connect()
    assert "ecircuitbreaker" in str(second.value).lower() and "not retried" in str(second.value)


def test_other_errors_are_still_retried(monkeypatch):
    calls = []

    def flaky(*a, **k):
        calls.append(1)
        raise psycopg.OperationalError("connection timeout expired")  # transient network problem, not a login failure

    monkeypatch.setattr(psycopg, "connect", flaky)
    for _ in range(3):
        with pytest.raises(OperationalError):
            db_session.engine.connect()
    assert len(calls) == 3  # transient failures must keep retrying


def test_api_returns_503_instantly_while_blocked(monkeypatch):
    from fastapi.testclient import TestClient

    from app.main import create_app

    monkeypatch.setattr(psycopg, "connect", lambda *a, **k: (_ for _ in ()).throw(psycopg.OperationalError('FATAL:  password authentication failed for user "postgres"')))
    with TestClient(create_app()) as c:
        body = {"email": "a@b.co", "password": "Strong1pass", "display_name": "A"}
        first = c.post("/api/v1/auth/register", json=body)
        second = c.post("/api/v1/auth/register", json=body)
    assert first.status_code == second.status_code == 503
    assert second.json()["error"]["code"] == "database_unavailable"
