import logging
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import AuthenticationError, ConflictError, RateLimitedError
from app.core.security import hash_password, verify_password
from app.models import User, UserRole

logger = logging.getLogger(__name__)


def get_by_id(db: Session, user_id: uuid.UUID) -> User | None:
    return db.get(User, user_id)


def get_by_email(db: Session, email: str) -> User | None:
    return db.scalar(select(User).where(User.email == email))


def create_user(db: Session, *, email: str, password: str, display_name: str, role: UserRole = UserRole.USER) -> User:
    user = User(email=email, password_hash=hash_password(password), display_name=display_name, role=role.value)
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise ConflictError("An account with this email already exists.", code="email_taken") from None
    return user


def authenticate(db: Session, *, email: str, password: str) -> User:
    """Verify credentials with brute-force lockout. Always the same error for bad email or bad password."""
    s = get_settings()
    now = datetime.now(timezone.utc)
    user = get_by_email(db, email)

    if user and user.locked_until and user.locked_until > now:
        minutes = max(1, int((user.locked_until - now).total_seconds() // 60) + 1)
        raise RateLimitedError(f"Too many failed attempts. Try again in {minutes} min.", code="account_locked")

    ok = verify_password(password, user.password_hash if user else None)
    if not user or not ok:
        if user:
            user.failed_login_attempts += 1
            if user.failed_login_attempts >= s.max_failed_logins:
                user.locked_until = now + timedelta(minutes=s.lockout_minutes)
                user.failed_login_attempts = 0
                logger.warning("Account locked after repeated failures: user_id=%s", user.id)
            db.commit()
        raise AuthenticationError("Incorrect email or password.", code="invalid_credentials")

    if not user.is_active:
        raise AuthenticationError("This account has been disabled. Contact an administrator.", code="account_disabled")

    user.failed_login_attempts = 0
    user.locked_until = None
    user.last_login_at = now
    db.commit()
    return user


def ensure_admin(db: Session) -> None:
    """Create the bootstrap admin from ADMIN_EMAIL/ADMIN_PASSWORD if missing. Never overwrites an existing user."""
    s = get_settings()
    if not (s.admin_email and s.admin_password):
        return
    email = s.admin_email.strip().lower()
    if get_by_email(db, email):
        return
    create_user(db, email=email, password=s.admin_password, display_name="Admin", role=UserRole.ADMIN)
    logger.info("Bootstrap admin created: %s", email)


def count_admins(db: Session) -> int:
    return db.scalar(select(func.count()).select_from(User).where(User.role == UserRole.ADMIN.value, User.is_active.is_(True))) or 0
