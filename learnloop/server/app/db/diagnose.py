"""Turn a raw database connection error into one short, actionable explanation (no tracebacks)."""
from urllib.parse import urlparse

from app.core.config import get_settings


def describe_target() -> str:
    u = urlparse(get_settings().database_url)
    return f"{u.hostname}:{u.port} as {u.username}"


def explain(exc: BaseException) -> str:
    text = str(exc)
    low = text.lower()
    if "ecircuitbreaker" in low:
        return (
            "Supabase's pooler has temporarily BLOCKED new connections after too many failed logins.\n"
            "  -> Stop retrying: every attempt with a wrong password extends the block.\n"
            "  -> Fix the password in DATABASE_URL first (Supabase > Project Settings > Database > Reset database password),\n"
            "     then wait ~5 minutes and run `npm run db:check` once."
        )
    if "password authentication failed" in low:
        return (
            "The database rejected the username/password in DATABASE_URL.\n"
            "  -> Supabase > Project Settings > Database > Reset database password, then copy the *Session pooler*\n"
            "     connection string into DATABASE_URL in .env (it has the form postgresql://postgres.<ref>:<password>@aws-...pooler.supabase.com:5432/postgres)."
        )
    if "tenant/user" in low and "not found" in low:
        return (
            "The pooler doesn't know this project (wrong project ref or region host, or the project is paused).\n"
            "  -> In Supabase click Connect, copy the *Session pooler* string exactly, and make sure the project isn't paused."
        )
    if "getaddrinfo" in low or "could not translate host" in low or "name or service not known" in low:
        return "The database host name can't be resolved. Check DATABASE_URL for typos and your internet connection."
    if "timeout" in low or "timed out" in low:
        return "Timed out reaching the database. Check your internet connection / firewall, and that the Supabase project is running."
    first = text.strip().splitlines()[0] if text.strip() else type(exc).__name__
    return f"Couldn't connect to the database: {first[:300]}"
