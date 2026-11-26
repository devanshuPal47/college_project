"""Application settings, loaded once from the environment (.env at the repo root)."""
from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

REPO_ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=REPO_ROOT / ".env", extra="ignore", case_sensitive=False)

    # --- runtime ---
    app_env: Literal["development", "production", "test"] = "development"
    log_level: str = "INFO"
    # comma-separated list of allowed browser origins (your deployed frontend URL(s), no trailing slash)
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    # how many reverse proxies sit in front of this app (0 = none/dev, 1 = Render). Used to find the real client IP.
    trusted_proxy_hops: int = 0

    # --- database (Supabase Postgres via the connection pooler) ---
    database_url: str
    db_pool_size: int = 5
    db_max_overflow: int = 5

    # --- auth ---
    jwt_secret: str = Field(min_length=32)
    jwt_algorithm: str = "HS256"
    access_token_ttl_minutes: int = 30
    refresh_token_ttl_days: int = 7
    max_failed_logins: int = 5
    lockout_minutes: int = 15
    admin_email: str | None = None
    admin_password: str | None = None

    # --- AI (Groq) ---
    groq_api_key: str = ""
    groq_chat_model: str = "openai/gpt-oss-20b"
    groq_feedback_model: str = "openai/gpt-oss-120b"
    ai_daily_quota: int = 40

    # --- rate limiting (per client IP, per minute) ---
    rate_limit_per_minute: int = 240
    auth_rate_limit_per_minute: int = 10

    @field_validator("database_url")
    @classmethod
    def _use_psycopg_driver(cls, v: str) -> str:
        # Accept the plain URL Supabase shows and select the psycopg3 driver for SQLAlchemy.
        if v.startswith("postgres://"):
            v = "postgresql://" + v.removeprefix("postgres://")
        if v.startswith("postgresql://"):
            v = "postgresql+psycopg://" + v.removeprefix("postgresql://")
        if not v.startswith("postgresql+psycopg://"):
            raise ValueError("DATABASE_URL must be a PostgreSQL URL (this project does not use local databases)")
        return v

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip().rstrip("/") for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
