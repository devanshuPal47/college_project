from fastapi import APIRouter

from app.api.deps import CurrentUser, ReadDb
from app.schemas.progress import ProgressRead, ProgressWrite
from app.services import progress as progress_service

router = APIRouter(prefix="/progress", tags=["progress"])


@router.get("", response_model=ProgressRead)
def get_my_progress(user: CurrentUser, db: ReadDb) -> ProgressRead:
    row = progress_service.get_progress(db, user.id)
    return ProgressRead(state=row.state if row else None, updated_at=row.updated_at if row else None)


@router.put("", response_model=ProgressRead)
def save_my_progress(body: ProgressWrite, user: CurrentUser, db: ReadDb) -> ProgressRead:
    updated_at = progress_service.save_progress(db, user.id, body.state)
    return ProgressRead(state=body.state, updated_at=updated_at)
