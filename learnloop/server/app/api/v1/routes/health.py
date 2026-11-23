from fastapi import APIRouter
from sqlalchemy import text

from app.api.deps import ReadDb
from app.core.config import get_settings
from app.core.errors import ServiceUnavailableError

router = APIRouter(prefix="/health", tags=["health"])


@router.get("", summary="Liveness probe")
def liveness() -> dict:
    return {"status": "ok"}


@router.get("/ready", summary="Readiness probe: database, migrations, AI config")
def readiness(db: ReadDb) -> dict:
    try:
        db.execute(text("select 1"))
        revision = db.execute(text("select version_num from alembic_version")).scalar()
    except Exception:
        raise ServiceUnavailableError("Database is not reachable or not migrated yet.", code="database_unavailable") from None
    return {"status": "ready", "database": "ok", "migration": revision, "ai_configured": bool(get_settings().groq_api_key)}
