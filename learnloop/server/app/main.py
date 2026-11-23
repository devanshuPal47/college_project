"""Application factory: `uvicorn app.main:app --app-dir server`."""
import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import get_settings
from app.core.errors import register_exception_handlers
from app.core.logging import configure_logging
from app.db.diagnose import explain
from app.db.session import SessionLocal
from app.middleware.access_log import AccessLogMiddleware
from app.middleware.rate_limit import RateLimitMiddleware
from app.middleware.request_id import RequestIdMiddleware
from app.middleware.security_headers import SecurityHeadersMiddleware
from app.services import users

logger = logging.getLogger("app")


def _bootstrap_admin() -> None:
    try:
        with SessionLocal() as db:
            users.ensure_admin(db)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Database not reachable at startup.\n%s", explain(exc))


@asynccontextmanager
async def lifespan(_: FastAPI):
    """Startup must never block on the database: serve immediately, create the bootstrap admin in the background.
    If the DB is down the API still answers (clear 503s) and /api/v1/health/ready reports it."""
    task = asyncio.create_task(asyncio.to_thread(_bootstrap_admin))
    yield
    task.cancel()


def create_app() -> FastAPI:
    s = get_settings()
    configure_logging(s.log_level)

    app = FastAPI(
        title="LearnLoop API",
        version="1.0.0",
        lifespan=lifespan,
        docs_url=None if s.is_production else "/api/docs",
        redoc_url=None,
        openapi_url=None if s.is_production else "/api/openapi.json",
    )
    register_exception_handlers(app)

    # Middleware runs outermost-first in REVERSE order of registration:
    # request-id -> CORS -> access log -> security headers -> rate limit -> routes
    app.add_middleware(RateLimitMiddleware, per_minute=s.rate_limit_per_minute, auth_per_minute=s.auth_rate_limit_per_minute)
    app.add_middleware(SecurityHeadersMiddleware, hsts=s.is_production)
    app.add_middleware(AccessLogMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=s.cors_origins,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
        expose_headers=["X-Request-ID", "Retry-After"],
    )
    app.add_middleware(RequestIdMiddleware)

    app.include_router(api_router)
    return app


app = create_app()
