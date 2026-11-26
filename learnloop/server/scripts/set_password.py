"""Set (or reset) a user's password, optionally promoting them to admin. The password is typed at a hidden prompt,
so it never lands in shell history or a chat window. Also signs the user out everywhere and clears any lockout.

    npm run set-password -- --email you@example.com [--admin]
"""
import argparse
import getpass
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from pydantic import ValidationError  # noqa: E402

from app.core.security import hash_password  # noqa: E402
from app.db.diagnose import explain  # noqa: E402
from app.db.session import SessionLocal  # noqa: E402
from app.models import UserRole  # noqa: E402
from app.schemas.auth import RegisterRequest  # noqa: E402
from app.schemas.user import normalize_email  # noqa: E402
from app.services import tokens, users  # noqa: E402


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--email", required=True)
    ap.add_argument("--admin", action="store_true", help="also make this user an admin")
    a = ap.parse_args()
    email = normalize_email(a.email)
    pw = getpass.getpass("New password: ")
    if pw != getpass.getpass("Repeat password: "):
        print("Passwords don't match.")
        return 1
    try:
        RegisterRequest(email=email, password=pw, display_name="x")  # reuse the signup password rules
    except ValidationError as e:
        print("Password rejected:", e.errors()[0]["msg"])
        return 1
    try:
        with SessionLocal() as db:
            user = users.get_by_email(db, email)
            if not user:
                print(f"No user with email {email}. Create the account in the app first.")
                return 1
            user.password_hash = hash_password(pw)
            user.failed_login_attempts, user.locked_until, user.is_active = 0, None, True
            if a.admin:
                user.role = UserRole.ADMIN.value
            db.commit()
            tokens.revoke_all(db, user.id)
    except Exception as exc:  # noqa: BLE001
        print(f"FAILED\n{explain(exc)}")
        return 1
    print(f"Password updated for {email}{' (now an admin)' if a.admin else ''}. All existing sessions were signed out.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
