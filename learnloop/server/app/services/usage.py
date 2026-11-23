import uuid
from datetime import datetime, timezone

from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import RateLimitedError
from app.models import AiUsage


def consume_ai_call(db: Session, user_id: uuid.UUID) -> int:
    """Atomically count one AI call for today. Raises if the daily quota is used up. Returns calls remaining."""
    limit = get_settings().ai_daily_quota
    today = datetime.now(timezone.utc).date()
    stmt = insert(AiUsage).values(user_id=user_id, day=today, calls=1)
    stmt = stmt.on_conflict_do_update(
        index_elements=[AiUsage.user_id, AiUsage.day],
        set_={"calls": AiUsage.calls + 1},
        where=AiUsage.calls < limit,  # no row returned when the limit is reached
    ).returning(AiUsage.calls)
    row = db.execute(stmt).first()
    db.commit()
    if row is None:
        raise RateLimitedError("You've used today's AI help. It resets tomorrow, and the tests still work!", code="ai_quota_exceeded")
    return limit - row[0]
