import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Query
from sqlalchemy import func, select

from app.api.deps import AdminUser, DbSession, ReadDb
from app.core.errors import ConflictError, NotFoundError
from app.models import AiUsage, User, UserProgress, UserRole
from app.schemas.admin import AdminStats, AdminUserList, AdminUserRead, AdminUserUpdate
from app.services import tokens, users

router = APIRouter(prefix="/admin", tags=["admin"])


def _summary(user: User, state: dict | None) -> AdminUserRead:
    state = state or {}
    completed = state.get("completed") or {}
    return AdminUserRead.model_validate(user, from_attributes=True).model_copy(
        update={
            "xp": int(state.get("xp") or 0),
            "streak": int(state.get("streak") or 0),
            "projects_completed": len(completed) if isinstance(completed, dict) else 0,
        }
    )


@router.get("/users", response_model=AdminUserList)
def list_users(
    _: AdminUser,
    db: ReadDb,
    search: str = Query("", max_length=100),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> AdminUserList:
    query = select(User, UserProgress.state).outerjoin(UserProgress, UserProgress.user_id == User.id)
    count_q = select(func.count()).select_from(User)
    if search.strip():
        like = f"%{search.strip().lower()}%"
        cond = func.lower(User.email).like(like) | func.lower(User.display_name).like(like)
        query, count_q = query.where(cond), count_q.where(cond)
    rows = db.execute(query.order_by(User.created_at.desc()).limit(limit).offset(offset)).all()
    return AdminUserList(items=[_summary(u, st) for u, st in rows], total=db.scalar(count_q) or 0)


@router.patch("/users/{user_id}", response_model=AdminUserRead)
def update_user(user_id: uuid.UUID, body: AdminUserUpdate, admin: AdminUser, db: DbSession) -> AdminUserRead:
    target = users.get_by_id(db, user_id)
    if target is None:
        raise NotFoundError("User not found.", code="user_not_found")
    if body.role is not None and body.role not in {r.value for r in UserRole}:
        raise ConflictError("Role must be 'user' or 'admin'.", code="invalid_role", status_code=422)

    removes_admin = target.is_admin and ((body.role == UserRole.USER.value) or (body.is_active is False))
    if target.id == admin.id and (removes_admin or body.is_active is False):
        raise ConflictError("You can't demote or disable your own account.", code="cannot_modify_self")
    if removes_admin and users.count_admins(db) <= 1:
        raise ConflictError("There must be at least one active admin.", code="last_admin")

    if body.role is not None:
        target.role = body.role
    if body.is_active is not None:
        target.is_active = body.is_active
    db.commit()
    if body.is_active is False:
        tokens.revoke_all(db, target.id)  # kick the user out immediately
    progress = db.get(UserProgress, target.id)
    return _summary(target, progress.state if progress else None)


@router.get("/stats", response_model=AdminStats)
def stats(_: AdminUser, db: ReadDb) -> AdminStats:
    now = datetime.now(timezone.utc)
    states = db.scalars(select(UserProgress.state)).all()
    return AdminStats(
        total_users=db.scalar(select(func.count()).select_from(User)) or 0,
        active_users=db.scalar(select(func.count()).select_from(User).where(User.is_active.is_(True))) or 0,
        admins=db.scalar(select(func.count()).select_from(User).where(User.role == UserRole.ADMIN.value)) or 0,
        new_last_7_days=db.scalar(select(func.count()).select_from(User).where(User.created_at >= now - timedelta(days=7))) or 0,
        total_projects_completed=sum(len(s.get("completed") or {}) for s in states if isinstance(s, dict)),
        ai_calls_today=db.scalar(select(func.coalesce(func.sum(AiUsage.calls), 0)).where(AiUsage.day == now.date())) or 0,
    )
