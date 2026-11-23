import re
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_validator

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def normalize_email(value: str) -> str:
    value = value.strip().lower()
    if len(value) > 320 or not _EMAIL_RE.match(value):
        raise ValueError("Enter a valid email address")
    return value


class EmailMixin(BaseModel):
    email: str

    @field_validator("email")
    @classmethod
    def _email(cls, v: str) -> str:
        return normalize_email(v)


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    display_name: str
    role: str
    is_active: bool
    created_at: datetime
    last_login_at: datetime | None = None
