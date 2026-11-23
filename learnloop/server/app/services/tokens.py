"""Issue, rotate and revoke JWT pairs. Refresh tokens are tracked in the database."""
import logging
import uuid
from datetime import datetime, timezone

import jwt
from sqlalchemy import update
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import AuthenticationError
from app.core.security import create_token, decode_token
from app.models import RefreshToken, User
from app.schemas.auth import TokenPair
from app.services import users

logger = logging.getLogger(__name__)


def issue_pair(db: Session, user: User) -> TokenPair:
    access, _, _ = create_token(user.id, "access")
    refresh, jti, expires = create_token(user.id, "refresh")
    db.add(RefreshToken(jti=jti, user_id=user.id, expires_at=expires))
    db.commit()
    return TokenPair(access_token=access, refresh_token=refresh, expires_in=get_settings().access_token_ttl_minutes * 60)


def rotate(db: Session, refresh_token: str) -> tuple[User, TokenPair]:
    """Exchange a refresh token for a new pair. A reused (already rotated) token revokes the whole family."""
    try:
        claims = decode_token(refresh_token, "refresh")
        user_id, jti = uuid.UUID(claims["sub"]), uuid.UUID(claims["jti"])
    except (jwt.PyJWTError, ValueError):
        raise AuthenticationError("Your session expired. Please sign in again.", code="invalid_refresh_token") from None

    record = db.get(RefreshToken, jti)
    now = datetime.now(timezone.utc)
    if record is None or record.user_id != user_id:
        raise AuthenticationError("Your session expired. Please sign in again.", code="invalid_refresh_token")
    if record.revoked_at is not None:
        logger.warning("Refresh token reuse detected, revoking all sessions: user_id=%s", user_id)
        revoke_all(db, user_id)
        raise AuthenticationError("Your session expired. Please sign in again.", code="refresh_token_reused")

    user = users.get_by_id(db, user_id)
    if user is None or not user.is_active:
        raise AuthenticationError("This account is unavailable.", code="account_disabled")

    record.revoked_at = now
    return user, issue_pair(db, user)  # issue_pair commits the revocation too


def revoke(db: Session, refresh_token: str) -> None:
    """Logout: revoke one refresh token. Silent if it is already invalid."""
    try:
        jti = uuid.UUID(decode_token(refresh_token, "refresh")["jti"])
    except (jwt.PyJWTError, ValueError):
        return
    db.execute(update(RefreshToken).where(RefreshToken.jti == jti, RefreshToken.revoked_at.is_(None)).values(revoked_at=datetime.now(timezone.utc)))
    db.commit()


def revoke_all(db: Session, user_id: uuid.UUID) -> None:
    db.execute(
        update(RefreshToken).where(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None)).values(revoked_at=datetime.now(timezone.utc))
    )
    db.commit()
