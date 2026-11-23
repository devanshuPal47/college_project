"""Alembic environment: uses the app's settings and model metadata."""
from logging.config import fileConfig

from alembic import context
from sqlalchemy import create_engine, pool

from app.core.config import get_settings
from app.db.base import Base
from app.db.diagnose import describe_target, explain
import app.models  # noqa: F401  (registers every model on Base.metadata)

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata
DATABASE_URL = get_settings().database_url


def run_migrations_offline() -> None:
    context.configure(url=DATABASE_URL, target_metadata=target_metadata, literal_binds=True, compare_type=True)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    engine = create_engine(DATABASE_URL, poolclass=pool.NullPool, connect_args={"prepare_threshold": None, "connect_timeout": 15})
    try:
        connection = engine.connect()
    except Exception as exc:  # noqa: BLE001
        # a clear message instead of a 100-line traceback
        raise SystemExit(f"\nMigration aborted. Target: {describe_target()}\n{explain(exc)}\n") from None
    with connection:
        context.configure(connection=connection, target_metadata=target_metadata, compare_type=True)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
