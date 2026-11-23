from pydantic import BaseModel, Field, field_validator

from app.schemas.user import EmailMixin, UserRead


class RegisterRequest(EmailMixin):
    password: str = Field(min_length=8, max_length=72)
    display_name: str = Field(min_length=1, max_length=80)

    @field_validator("display_name")
    @classmethod
    def _name(cls, v: str) -> str:
        v = " ".join(v.split())
        if not v:
            raise ValueError("Display name is required")
        return v

    @field_validator("password")
    @classmethod
    def _password(cls, v: str) -> str:
        if len(v.encode()) > 72:  # bcrypt ignores everything past 72 bytes
            raise ValueError("Password is too long (max 72 bytes)")
        if v.strip() != v or v.isdigit() or v.isalpha():
            raise ValueError("Use letters and numbers (or symbols) with no leading or trailing spaces")
        return v


class LoginRequest(EmailMixin):
    password: str = Field(min_length=1, max_length=72)


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # access token lifetime in seconds


class AuthResponse(BaseModel):
    user: UserRead
    tokens: TokenPair
