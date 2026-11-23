from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: str = Field(pattern="^(user|assistant)$")
    content: str = Field(max_length=4000)


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1, max_length=20)
    project: dict | None = None
    code: dict | None = None
    results: list[dict] | None = None
    hint_level: int = Field(default=1, ge=1, le=3)  # 1 nudge, 2 targeted hint, 3 guided walk-through
    attempts: int = Field(default=0, ge=0, le=1000)  # how many times the learner has run the checks
    mode: str = Field(default="guided", pattern="^(guided|challenge)$")


class ChatResponse(BaseModel):
    reply: str


class FeedbackRequest(BaseModel):
    project: dict
    code: dict
    results: list[dict]


class FeedbackResponse(BaseModel):
    strengths: list[str]
    fixes: list[str]
    next_step: str
