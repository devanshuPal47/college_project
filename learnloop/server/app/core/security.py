"""Password hashing and JWT helpers. No database or HTTP knowledge lives here."""
import uuid
from datetime import datetime, timedelta, timezone
from typing import Literal

import bcrypt
import jwt

from app.core.config import get_settings

TokenType = Literal["access", "refresh"]
_BCRYPT_ROUNDS = 12
# Pre-computed so login takes the same time whether or not the email exists.
_DUMMY_HASH = bcrypt.hashpw(b"timing-equalizer", bcrypt.gensalt(_BCRYPT_ROUNDS)).decode()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt(_BCRYPT_ROUNDS)).decode()


def verify_password(password: str, password_hash: str | None) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), (password_hash or _DUMMY_HASH).encode()) and password_hash is not None
    except ValueError:
        return False


def _now() -> datetime:
    return datetime.now(timezone.utc)


def create_token(subject: uuid.UUID, token_type: TokenType, *, jti: uuid.UUID | None = None) -> tuple[str, uuid.UUID, datetime]:
    """Return (encoded_jwt, jti, expires_at)."""
    s = get_settings()
    ttl = timedelta(minutes=s.access_token_ttl_minutes) if token_type == "access" else timedelta(days=s.refresh_token_ttl_days)
    jti = jti or uuid.uuid4()
    issued = _now()
    expires = issued + ttl
    payload = {"sub": str(subject), "typ": token_type, "jti": str(jti), "iat": issued, "exp": expires}
    return jwt.encode(payload, s.jwt_secret, algorithm=s.jwt_algorithm), jti, expires


def decode_token(token: str, expected_type: TokenType) -> dict:
    """Validate signature, expiry and token type. Raises jwt.PyJWTError on any problem."""
    s = get_settings()
    claims = jwt.decode(token, s.jwt_secret, algorithms=[s.jwt_algorithm], options={"require": ["exp", "sub", "jti", "typ"]})
    if claims.get("typ") != expected_type:
        raise jwt.InvalidTokenError("wrong token type")
    return claims
