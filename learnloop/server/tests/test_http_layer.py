"""Middleware, error envelope and auth guards. None of these touch the database."""
from fastapi.testclient import TestClient

from app.main import create_app


def test_liveness_ok(client):
    r = client.get("/api/v1/health")
    assert r.status_code == 200 and r.json() == {"status": "ok"}


def test_request_id_generated_and_echoed(client):
    assert len(client.get("/api/v1/health").headers["x-request-id"]) >= 8
    r = client.get("/api/v1/health", headers={"X-Request-ID": "trace-abc-12345"})
    assert r.headers["x-request-id"] == "trace-abc-12345"


def test_malformed_request_id_is_replaced(client):
    r = client.get("/api/v1/health", headers={"X-Request-ID": "bad id\twith spaces"})
    assert r.headers["x-request-id"] != "bad id\twith spaces"


def test_security_headers_present(client):
    h = client.get("/api/v1/health").headers
    assert h["x-content-type-options"] == "nosniff"
    assert h["x-frame-options"] == "DENY"
    assert h["referrer-policy"] == "no-referrer"
    assert h["cache-control"] == "no-store"


def test_cors_allows_dev_origin_only(client):
    ok = client.options("/api/v1/auth/login", headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "POST"})
    assert ok.headers.get("access-control-allow-origin") == "http://localhost:5173"
    bad = client.options("/api/v1/auth/login", headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "POST"})
    assert "access-control-allow-origin" not in bad.headers


def test_protected_routes_require_a_token(client):
    for method, path in [("get", "/api/v1/auth/me"), ("get", "/api/v1/progress"), ("get", "/api/v1/admin/users"), ("post", "/api/v1/ai/chat")]:
        r = getattr(client, method)(path)
        assert r.status_code == 401, path
        body = r.json()["error"]
        assert body["code"] == "not_authenticated" and body["request_id"] == r.headers["x-request-id"]
        assert r.headers["www-authenticate"] == "Bearer"


def test_garbage_token_rejected(client):
    r = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer not.a.jwt"})
    assert r.status_code == 401 and r.json()["error"]["code"] == "invalid_token"


def test_refresh_token_cannot_be_used_as_access_token(client):
    from uuid import uuid4

    from app.core.security import create_token

    refresh, _, _ = create_token(uuid4(), "refresh")
    r = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {refresh}"})
    assert r.status_code == 401 and r.json()["error"]["code"] == "invalid_token"


def test_validation_errors_use_the_envelope(client):
    r = client.post("/api/v1/auth/register", json={"email": "nope", "password": "short", "display_name": ""})
    assert r.status_code == 422
    err = r.json()["error"]
    assert err["code"] == "validation_error" and {d["field"] for d in err["details"]} >= {"email", "password", "display_name"}


def test_weak_passwords_rejected(client):
    for pw in ["12345678", "abcdefgh", " spaces123 "]:
        r = client.post("/api/v1/auth/register", json={"email": "a@b.co", "password": pw, "display_name": "A"})
        assert r.status_code == 422, pw


def test_unknown_route_uses_the_envelope(client):
    r = client.get("/api/v1/nope")
    assert r.status_code == 404 and r.json()["error"]["code"] == "http_error"


def test_auth_endpoints_are_rate_limited():
    with TestClient(create_app()) as c:
        codes = [c.post("/api/v1/auth/login", json={"email": "bad", "password": "x"}).status_code for _ in range(12)]
    assert codes[:10] == [422] * 10
    assert codes[10] == 429
    # the 429 carries Retry-After and the standard envelope
    with TestClient(create_app()) as c2:
        for _ in range(10):
            c2.post("/api/v1/auth/login", json={"email": "bad", "password": "x"})
        r = c2.post("/api/v1/auth/login", json={"email": "bad", "password": "x"})
    assert r.status_code == 429 and int(r.headers["retry-after"]) >= 1 and r.json()["error"]["code"] == "rate_limited"
