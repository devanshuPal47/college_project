"""Behaviour that only matters once the API is deployed behind Render's proxy. No database needed."""
import pytest
from fastapi.testclient import TestClient

from app import main as app_main
from app.core.config import get_settings
from app.core.net import client_ip


def _scope(xff: str | None = None, peer: str = "10.0.0.9") -> dict:
    return {"client": (peer, 1234), "headers": [(b"x-forwarded-for", xff.encode())] if xff else []}


def test_dev_ignores_forwarded_header_entirely():
    assert client_ip(_scope("1.2.3.4"), 0) == "10.0.0.9"


def test_one_proxy_uses_the_entry_our_proxy_appended():
    assert client_ip(_scope("203.0.113.5"), 1) == "203.0.113.5"


def test_forged_left_entries_are_ignored():
    # an attacker prepends fake addresses; only what OUR proxy appended (rightmost) counts
    assert client_ip(_scope("6.6.6.6, 7.7.7.7, 203.0.113.5"), 1) == "203.0.113.5"


def test_two_proxies_skip_the_cdn_address():
    assert client_ip(_scope("203.0.113.5, 172.70.1.1"), 2) == "203.0.113.5"


def test_falls_back_to_the_socket_peer_when_the_header_is_short_or_missing():
    assert client_ip(_scope(None), 1) == "10.0.0.9"
    assert client_ip(_scope("1.1.1.1"), 2) == "10.0.0.9"


@pytest.fixture()
def prod_client(monkeypatch):
    prod = get_settings().model_copy(
        update={
            "app_env": "production",
            "cors_origins": "https://learnloop-web.onrender.com, https://second.example.com/",
            "trusted_proxy_hops": 1,
        }
    )
    monkeypatch.setattr(app_main, "get_settings", lambda: prod)
    with TestClient(app_main.create_app()) as c:
        yield c


def test_production_hides_the_api_docs(prod_client):
    assert prod_client.get("/api/docs").status_code == 404
    assert prod_client.get("/api/openapi.json").status_code == 404


def test_production_sends_hsts(prod_client):
    assert "max-age=31536000" in prod_client.get("/api/v1/health").headers["strict-transport-security"]


def test_cors_accepts_only_the_configured_frontends(prod_client):
    def preflight(origin):
        return prod_client.options("/api/v1/auth/login", headers={"Origin": origin, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "authorization,content-type"})

    ok = preflight("https://learnloop-web.onrender.com")
    assert ok.status_code == 200 and ok.headers["access-control-allow-origin"] == "https://learnloop-web.onrender.com"
    assert ok.headers["access-control-max-age"] == "86400"
    assert preflight("https://second.example.com").headers["access-control-allow-origin"] == "https://second.example.com"  # trailing slash/space tolerated
    assert "access-control-allow-origin" not in preflight("https://evil.example").headers
    assert "access-control-allow-origin" not in preflight("http://localhost:5173").headers  # dev origin is NOT allowed in prod


def test_rate_limit_buckets_follow_the_real_client_not_a_forged_header(prod_client):
    bad = {"email": "x", "password": "y"}  # 422 before touching the database
    forged = {"X-Forwarded-For": "1.1.1.1, 9.9.9.9"}  # attacker-controlled left entry, real client (right) = 9.9.9.9
    codes = [prod_client.post("/api/v1/auth/login", json=bad, headers=forged).status_code for _ in range(12)]
    assert 429 in codes  # the real client got throttled despite the forged prefix
    other = prod_client.post("/api/v1/auth/login", json=bad, headers={"X-Forwarded-For": "1.1.1.1, 8.8.8.8"})
    assert other.status_code == 422  # a different real client has its own bucket
