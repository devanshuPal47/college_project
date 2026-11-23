from fastapi import APIRouter

from app.api.deps import CurrentUser, ReadDb
from app.schemas.ai import ChatRequest, ChatResponse, FeedbackRequest, FeedbackResponse
from app.services import ai as ai_service
from app.services import usage

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/chat", response_model=ChatResponse)
async def chat(body: ChatRequest, user: CurrentUser, db: ReadDb) -> ChatResponse:
    ai_service.ensure_configured()
    usage.consume_ai_call(db, user.id)
    return ChatResponse(reply=await ai_service.chat(body))


@router.post("/feedback", response_model=FeedbackResponse)
async def feedback(body: FeedbackRequest, user: CurrentUser, db: ReadDb) -> FeedbackResponse:
    ai_service.ensure_configured()
    key = ai_service.feedback_cache_key(body)
    if (hit := ai_service.cached_feedback(key)) is not None:  # identical submission: instant and free
        return hit
    usage.consume_ai_call(db, user.id)
    return await ai_service.feedback(body, key)
