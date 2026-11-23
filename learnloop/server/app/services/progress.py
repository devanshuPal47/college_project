import json
import uuid
from datetime import datetime

from sqlalchemy import func
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.models import UserProgress

MAX_STATE_BYTES = 256 * 1024


def get_progress(db: Session, user_id: uuid.UUID) -> UserProgress | None:
    return db.get(UserProgress, user_id)


def save_progress(db: Session, user_id: uuid.UUID, state: dict) -> datetime:
    if len(json.dumps(state, separators=(",", ":"))) > MAX_STATE_BYTES:
        raise AppError("Progress data is too large.", code="payload_too_large", status_code=413)
    stmt = insert(UserProgress).values(user_id=user_id, state=state)
    stmt = stmt.on_conflict_do_update(index_elements=[UserProgress.user_id], set_={"state": stmt.excluded.state, "updated_at": func.now()})
    updated_at = db.execute(stmt.returning(UserProgress.updated_at)).scalar_one()
    db.commit()
    return updated_at
