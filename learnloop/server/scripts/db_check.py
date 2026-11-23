"""One connection attempt, a clear verdict. Safe to run: it never retries (retries can trip Supabase's circuit breaker).

    npm run db:check
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import create_engine, text  # noqa: E402

from app.core.config import get_settings  # noqa: E402
from app.db.diagnose import describe_target, explain  # noqa: E402


def main() -> int:
    print(f"Target: {describe_target()}")
    engine = create_engine(get_settings().database_url, connect_args={"prepare_threshold": None, "connect_timeout": 8})
    try:
        with engine.connect() as c:
            who = c.execute(text("select current_database(), current_user")).one()
            public = c.execute(text("select count(*) from pg_tables where schemaname = 'public'")).scalar()
            try:
                rev = c.execute(text("select version_num from alembic_version")).scalar()
            except Exception:  # noqa: BLE001
                c.rollback()
                rev = None
    except Exception as exc:  # noqa: BLE001
        print(f"\nFAILED\n{explain(exc)}")
        return 1
    print(f"OK: connected to {who[0]} as {who[1]}")
    print(f"public tables: {public} | migration: {rev or 'not applied yet (run: npm run db:upgrade)'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
