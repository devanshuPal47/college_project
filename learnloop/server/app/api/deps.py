"""Reusable FastAPI dependencies: database session, current user, role guards."""
import uuid
from typing import Annotated

import jwt
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.errors import AuthenticationError, PermissionDeniedError
from app.core.security import decode_token
from app.db.session import get_db, get_read_db
from app.models import User, UserRole
from app.services import users

DbSession = Annotated[Session, Depends(get_db)]  # real transaction: use for multi-statement writes
ReadDb = Annotated[Session, Depends(get_read_db)]  # autocommit: reads and single-statement writes
_bearer = HTTPBearer(auto_error=False)


def get_current_user(
    db: ReadDb,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> User:
    """Resolve the bearer access token to an active user. Role is read from the DB, never trusted from the token."""
    if credentials is None:
        raise AuthenticationError("Sign in to continue.", code="not_authenticated")
    try:
        user_id = uuid.UUID(decode_token(credentials.credentials, "access")["sub"])
    except jwt.ExpiredSignatureError:
        raise AuthenticationError("Your session expired.", code="token_expired") from None
    except (jwt.PyJWTError, ValueError):
        raise AuthenticationError("Invalid credentials.", code="invalid_token") from None
    user = users.get_by_id(db, user_id)
    if user is None or not user.is_active:
        raise AuthenticationError("This account is unavailable.", code="account_disabled")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_roles(*roles: UserRole):
    """Dependency factory for RBAC: `Depends(require_roles(UserRole.ADMIN))`."""
    allowed = {r.value for r in roles}

    def _guard(user: CurrentUser) -> User:
        if user.role not in allowed:
            raise PermissionDeniedError("You don't have permission to do that.", code="insufficient_role")
        return user

    return _guard


AdminUser = Annotated[User, Depends(require_roles(UserRole.ADMIN))]
