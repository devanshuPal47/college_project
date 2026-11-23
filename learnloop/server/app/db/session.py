"""Engine and session factory for Supabase Postgres (through the Supavisor pooler)."""
import time
from collections.abc import Iterator

import psycopg
from sqlalchemy import create_engine, event
from sqlalchemy import exc as sa_exc
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings

_settings = get_settings()

engine = create_engine(
    _settings.database_url,
    pool_size=_settings.db_pool_size,
    max_overflow=_settings.db_max_overflow,
    pool_pre_ping=False,  # a ping before EVERY use costs a full network round trip; see _ping_if_idle below
    pool_recycle=240,
    pool_timeout=5,  # fail fast instead of queueing requests behind a dead database
    # Disable server-side prepared statements: required for the pooler's transaction mode
    # (port 6543) and harmless in session mode (port 5432).
    connect_args={"prepare_threshold": None, "connect_timeout": 5},
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

# Reads and single-statement writes run in AUTOCOMMIT: no BEGIN / COMMIT / ROLLBACK round trips. The database is in
# Seoul, so every avoided round trip saves ~150ms. Multi-statement writes keep using SessionLocal (real transactions).
ReadSessionLocal = sessionmaker(bind=engine.execution_options(isolation_level="AUTOCOMMIT"), autoflush=False, expire_on_commit=False)

IDLE_PING_SECONDS = 20


@event.listens_for(engine, "checkout")
def _ping_if_idle(dbapi_conn, conn_record, conn_proxy):
    """Only health-check connections that sat idle (the pooler may have dropped them); busy ones are known good."""
    now = time.monotonic()
    last = conn_record.info.get("last_checkout", now)
    conn_record.info["last_checkout"] = now
    if now - last > IDLE_PING_SECONDS:
        try:
            dbapi_conn.execute("select 1")
            dbapi_conn.rollback()
        except Exception as exc:  # noqa: BLE001
            raise sa_exc.DisconnectionError() from exc

# --- login guard -------------------------------------------------------------------------------------
# A wrong database password can never succeed on retry, and every failed login counts toward Supabase's
# circuit breaker (which then blocks us for minutes). After one such failure we stop contacting the database
# for LOGIN_BACKOFF_SECONDS and fail instantly with the original reason instead.
LOGIN_BACKOFF_SECONDS = 120
_login_block = {"until": 0.0, "reason": ""}


@event.listens_for(engine, "do_connect")
def _guarded_connect(dialect, conn_rec, cargs, cparams):
    now = time.monotonic()
    if now < _login_block["until"]:
        raise psycopg.OperationalError(f"{_login_block['reason']} [not retried for another {int(_login_block['until'] - now)}s to avoid a Supabase block]")
    try:
        return psycopg.connect(*cargs, **cparams)
    except psycopg.OperationalError as exc:
        low = str(exc).lower()
        if "password authentication failed" in low or "ecircuitbreaker" in low:
            _login_block["until"] = now + LOGIN_BACKOFF_SECONDS
            _login_block["reason"] = str(exc).strip().splitlines()[0]
        raise


def get_db() -> Iterator[Session]:
    """FastAPI dependency: one session per request, always closed."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_read_db() -> Iterator[Session]:
    """FastAPI dependency for reads and single-statement writes (autocommit)."""
    db = ReadSessionLocal()
    try:
        yield db
    finally:
        db.close()
