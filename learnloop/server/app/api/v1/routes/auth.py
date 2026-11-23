from fastapi import APIRouter, Response, status

from app.api.deps import CurrentUser, DbSession
from app.schemas.auth import AuthResponse, LoginRequest, RefreshRequest, RegisterRequest, TokenPair
from app.schemas.user import UserRead
from app.services import tokens, users

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(body: RegisterRequest, db: DbSession) -> AuthResponse:
    # Self-registration always creates a normal user. Admins are only bootstrapped or promoted by an admin.
    user = users.create_user(db, email=body.email, password=body.password, display_name=body.display_name)
    return AuthResponse(user=UserRead.model_validate(user), tokens=tokens.issue_pair(db, user))


@router.post("/login", response_model=AuthResponse)
def login(body: LoginRequest, db: DbSession) -> AuthResponse:
    user = users.authenticate(db, email=body.email, password=body.password)
    return AuthResponse(user=UserRead.model_validate(user), tokens=tokens.issue_pair(db, user))


@router.post("/refresh", response_model=TokenPair)
def refresh(body: RefreshRequest, db: DbSession) -> TokenPair:
    _, pair = tokens.rotate(db, body.refresh_token)
    return pair


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(body: RefreshRequest, db: DbSession) -> Response:
    tokens.revoke(db, body.refresh_token)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/me", response_model=UserRead)
def me(user: CurrentUser) -> UserRead:
    return UserRead.model_validate(user)
