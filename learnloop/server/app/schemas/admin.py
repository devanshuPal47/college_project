from pydantic import BaseModel

from app.schemas.user import UserRead


class AdminUserRead(UserRead):
    xp: int = 0
    streak: int = 0
    projects_completed: int = 0


class AdminUserList(BaseModel):
    items: list[AdminUserRead]
    total: int


class AdminUserUpdate(BaseModel):
    role: str | None = None
    is_active: bool | None = None


class AdminStats(BaseModel):
    total_users: int
    active_users: int
    admins: int
    new_last_7_days: int
    total_projects_completed: int
    ai_calls_today: int
