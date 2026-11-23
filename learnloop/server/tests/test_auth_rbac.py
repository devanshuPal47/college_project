"""Auth, JWT rotation, RBAC and progress. Runs against the real Supabase database (skipped if unreachable)."""
from sqlalchemy import select

from app.db.session import SessionLocal
from app.models import RefreshToken, User
from tests.conftest import bearer


def test_register_login_me(client, make_user):
    u = make_user()
    assert u["user"]["role"] == "user" and "password" not in u["user"]
    assert client.get("/api/v1/auth/me", headers=bearer(u)).json()["email"] == u["email"]
    login = client.post("/api/v1/auth/login", json={"email": u["email"].upper(), "password": u["password"]})
    assert login.status_code == 200  # email is case-insensitive


def test_duplicate_email_conflict(client, make_user):
    u = make_user()
    r = client.post("/api/v1/auth/register", json={"email": u["email"], "password": "An0therPass!", "display_name": "Dup"})
    assert r.status_code == 409 and r.json()["error"]["code"] == "email_taken"


def test_wrong_password_is_generic(client, make_user):
    u = make_user()
    wrong = client.post("/api/v1/auth/login", json={"email": u["email"], "password": "WrongPass123"})
    unknown = client.post("/api/v1/auth/login", json={"email": "nobody-here@example.test", "password": "WrongPass123"})
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json()["error"]["message"] == unknown.json()["error"]["message"]  # no account enumeration


def test_refresh_rotation_and_reuse_detection(client, make_user):
    u = make_user()
    old = u["tokens"]["refresh_token"]
    r1 = client.post("/api/v1/auth/refresh", json={"refresh_token": old})
    assert r1.status_code == 200
    new = r1.json()["refresh_token"]
    assert new != old
    # replaying the already-rotated token is treated as theft: it fails AND revokes the whole family
    assert client.post("/api/v1/auth/refresh", json={"refresh_token": old}).status_code == 401
    assert client.post("/api/v1/auth/refresh", json={"refresh_token": new}).status_code == 401


def test_logout_revokes_refresh_token(client, make_user):
    u = make_user()
    rt = u["tokens"]["refresh_token"]
    assert client.post("/api/v1/auth/logout", json={"refresh_token": rt}).status_code == 204
    assert client.post("/api/v1/auth/refresh", json={"refresh_token": rt}).status_code == 401


def test_lockout_after_repeated_failures(client, make_user):
    u = make_user()
    for _ in range(5):
        client.post("/api/v1/auth/login", json={"email": u["email"], "password": "WrongPass123"})
    locked = client.post("/api/v1/auth/login", json={"email": u["email"], "password": u["password"]})
    assert locked.status_code == 429 and locked.json()["error"]["code"] == "account_locked"


def test_normal_user_cannot_use_admin_routes(client, make_user):
    u = make_user()
    for method, path in [("get", "/api/v1/admin/users"), ("get", "/api/v1/admin/stats")]:
        r = getattr(client, method)(path, headers=bearer(u))
        assert r.status_code == 403 and r.json()["error"]["code"] == "insufficient_role"


def test_admin_can_list_users_and_see_stats(client, admin_headers, make_user):
    u = make_user()
    users = client.get("/api/v1/admin/users", headers=admin_headers, params={"search": u["email"]})
    assert users.status_code == 200 and users.json()["total"] == 1
    stats = client.get("/api/v1/admin/stats", headers=admin_headers).json()
    assert stats["total_users"] >= 2 and stats["admins"] >= 1


def test_admin_promote_demote_and_guards(client, admin_headers, make_user):
    u = make_user()
    uid = u["user"]["id"]
    promoted = client.patch(f"/api/v1/admin/users/{uid}", headers=admin_headers, json={"role": "admin"})
    assert promoted.status_code == 200 and promoted.json()["role"] == "admin"
    assert client.get("/api/v1/admin/stats", headers=bearer(u)).status_code == 200  # role is read from the DB live
    assert client.patch(f"/api/v1/admin/users/{uid}", headers=admin_headers, json={"role": "user"}).json()["role"] == "user"
    assert client.patch(f"/api/v1/admin/users/{uid}", headers=admin_headers, json={"role": "superuser"}).status_code == 422
    me = client.get("/api/v1/auth/me", headers=admin_headers).json()
    assert client.patch(f"/api/v1/admin/users/{me['id']}", headers=admin_headers, json={"role": "user"}).json()["error"]["code"] == "cannot_modify_self"


def test_disabling_a_user_locks_them_out_immediately(client, admin_headers, make_user):
    u = make_user()
    assert client.patch(f"/api/v1/admin/users/{u['user']['id']}", headers=admin_headers, json={"is_active": False}).status_code == 200
    assert client.get("/api/v1/auth/me", headers=bearer(u)).status_code == 401  # existing access token stops working
    assert client.post("/api/v1/auth/refresh", json={"refresh_token": u["tokens"]["refresh_token"]}).status_code == 401
    assert client.post("/api/v1/auth/login", json={"email": u["email"], "password": u["password"]}).json()["error"]["code"] == "account_disabled"


def test_progress_roundtrip_is_per_user(client, make_user):
    a, b = make_user(), make_user()
    assert client.get("/api/v1/progress", headers=bearer(a)).json()["state"] is None
    state = {"onboarded": True, "xp": 120, "completed": {"profile-card": {"xp": 40}}}
    assert client.put("/api/v1/progress", headers=bearer(a), json={"state": state}).status_code == 200
    assert client.get("/api/v1/progress", headers=bearer(a)).json()["state"] == state
    assert client.get("/api/v1/progress", headers=bearer(b)).json()["state"] is None  # isolation


def test_progress_too_large_rejected(client, make_user):
    u = make_user()
    r = client.put("/api/v1/progress", headers=bearer(u), json={"state": {"blob": "x" * 300_000}})
    assert r.status_code == 413


def test_user_delete_cascades_tokens(client, make_user):
    u = make_user()
    with SessionLocal() as db:
        assert db.scalars(select(RefreshToken).where(RefreshToken.user_id == u["user"]["id"])).first() is not None
        assert db.scalar(select(User).where(User.email == u["email"])) is not None
