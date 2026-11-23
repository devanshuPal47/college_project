"""Wipe the application's `public` schema so the database starts green-field.

Scope is deliberately narrow:
  * only the `public` schema: Supabase's own schemas (auth, storage, realtime, ...) are never touched
  * extension-owned objects (e.g. pgcrypto/uuid functions) are kept
  * dry run by default; pass --yes to actually drop

Usage (from the repo root):
    npm run db:reset             # list what would be dropped
    npm run db:reset -- --yes    # drop it, then run `npm run db:upgrade`
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import create_engine, text  # noqa: E402

from app.core.config import get_settings  # noqa: E402
from app.db.diagnose import describe_target, explain  # noqa: E402

NOT_EXTENSION_OWNED = "NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = {oid} AND d.deptype = 'e')"

INVENTORY = {
    "tables": "SELECT format('%I', tablename) FROM pg_tables WHERE schemaname = 'public' ORDER BY 1",
    "views": "SELECT format('%I', viewname) FROM pg_views WHERE schemaname = 'public' ORDER BY 1",
    "materialized views": "SELECT format('%I', matviewname) FROM pg_matviews WHERE schemaname = 'public' ORDER BY 1",
    "functions": (
        "SELECT p.oid::regprocedure::text FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace "
        "WHERE n.nspname = 'public' AND p.prokind IN ('f','p') AND " + NOT_EXTENSION_OWNED.format(oid="p.oid") + " ORDER BY 1"
    ),
    "enum types": (
        "SELECT format('%I', t.typname) FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace "
        "WHERE n.nspname = 'public' AND t.typtype = 'e' AND " + NOT_EXTENSION_OWNED.format(oid="t.oid") + " ORDER BY 1"
    ),
    "sequences": (
        "SELECT format('%I', c.relname) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace "
        "WHERE n.nspname = 'public' AND c.relkind = 'S' AND " + NOT_EXTENSION_OWNED.format(oid="c.oid") + " ORDER BY 1"
    ),
}

DROP = {
    "tables": 'DROP TABLE IF EXISTS public.{} CASCADE',
    "views": 'DROP VIEW IF EXISTS public.{} CASCADE',
    "materialized views": 'DROP MATERIALIZED VIEW IF EXISTS public.{} CASCADE',
    "functions": "DROP FUNCTION IF EXISTS {} CASCADE",
    "enum types": 'DROP TYPE IF EXISTS public.{} CASCADE',
    "sequences": 'DROP SEQUENCE IF EXISTS public.{} CASCADE',
}


def main() -> int:
    apply = "--yes" in sys.argv
    engine = create_engine(get_settings().database_url, connect_args={"prepare_threshold": None, "connect_timeout": 10})
    try:
        engine.connect().close()  # one attempt, so a bad login gives a clear message instead of a traceback
    except Exception as exc:  # noqa: BLE001
        print(f"Target: {describe_target()}\n\nFAILED\n{explain(exc)}")
        return 1
    with engine.begin() as conn:
        host = conn.execute(text("select current_database() || ' as ' || current_user")).scalar()
        print(f"Connected: {host}")
        found: dict[str, list[str]] = {k: [r[0] for r in conn.execute(text(q))] for k, q in INVENTORY.items()}
        total = sum(len(v) for v in found.values())
        for kind, names in found.items():
            if names:
                print(f"  {kind}: {', '.join(names)}")
        if total == 0:
            print("The public schema is already empty. Nothing to do.")
            return 0
        if not apply:
            print(f"\nDRY RUN: {total} object(s) would be dropped. Re-run with --yes to drop them.")
            return 0
        for kind in ("views", "materialized views", "tables", "functions", "enum types", "sequences"):
            for name in found[kind]:
                conn.execute(text(DROP[kind].format(name)))
        print(f"\nDropped {total} object(s). Now run: npm run db:upgrade")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
