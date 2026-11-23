"""Per-request context shared by middleware, logging and error handling."""
from contextvars import ContextVar

request_id_ctx: ContextVar[str] = ContextVar("request_id", default="-")
