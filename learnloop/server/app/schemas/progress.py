from datetime import datetime

from pydantic import BaseModel


class ProgressRead(BaseModel):
    state: dict | None
    updated_at: datetime | None = None


class ProgressWrite(BaseModel):
    state: dict
