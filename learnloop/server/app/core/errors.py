"""Domain errors and the single JSON error envelope returned by every failing request.

    {"error": {"code": "invalid_credentials", "message": "...", "request_id": "..."}}
"""
import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import InterfaceError, OperationalError, SQLAlchemyError
from sqlalchemy.exc import TimeoutError as SATimeoutError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.context import request_id_ctx

logger = logging.getLogger(__name__)


class AppError(Exception):
    """Base class for expected, user-facing errors."""

    status_code = 400
    code = "bad_request"

    def __init__(self, message: str, *, code: str | None = None, status_code: int | None = None):
        super().__init__(message)
        self.message = message
        if code:
            self.code = code
        if status_code:
            self.status_code = status_code


class AuthenticationError(AppError):
    status_code = 401
    code = "unauthenticated"


class PermissionDeniedError(AppError):
    status_code = 403
    code = "forbidden"


class NotFoundError(AppError):
    status_code = 404
    code = "not_found"


class ConflictError(AppError):
    status_code = 409
    code = "conflict"


class RateLimitedError(AppError):
    status_code = 429
    code = "rate_limited"


class ServiceUnavailableError(AppError):
    status_code = 503
    code = "service_unavailable"


def _envelope(status: int, code: str, message: str, headers: dict | None = None, details=None) -> JSONResponse:
    body: dict = {"error": {"code": code, "message": message, "request_id": request_id_ctx.get()}}
    if details:
        body["error"]["details"] = details
    return JSONResponse(body, status_code=status, headers=headers)


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(_: Request, exc: AppError) -> JSONResponse:
        headers = {"WWW-Authenticate": "Bearer"} if exc.status_code == 401 else None
        return _envelope(exc.status_code, exc.code, exc.message, headers)

    @app.exception_handler(StarletteHTTPException)
    async def _http_error(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        return _envelope(exc.status_code, "http_error", str(exc.detail))

    @app.exception_handler(RequestValidationError)
    async def _validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        details = [{"field": ".".join(str(p) for p in e["loc"][1:]), "message": e["msg"]} for e in exc.errors()]
        first = details[0]["message"] if details else "Invalid request"
        return _envelope(422, "validation_error", first, details=details)

    @app.exception_handler(SQLAlchemyError)
    async def _database_error(_: Request, exc: SQLAlchemyError) -> JSONResponse:
        # Connection/auth/pool problems are an outage, not a bug in the request: say so, fast, with a 503.
        logger.error("Database error (%s): %s", type(exc).__name__, str(exc).splitlines()[0][:300] if str(exc) else "")
        if isinstance(exc, (OperationalError, InterfaceError, SATimeoutError)):
            return _envelope(
                503, "database_unavailable",
                "The database is unreachable right now. If you're the developer, check DATABASE_URL and that the Supabase project is running.",
            )
        return _envelope(500, "internal_error", "Something went wrong on our side. Please try again.")

    @app.exception_handler(Exception)
    async def _unhandled(_: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled error: %s", exc)
        return _envelope(500, "internal_error", "Something went wrong on our side. Please try again.")
