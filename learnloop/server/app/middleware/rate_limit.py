import json
import math
import time
from collections import defaultdict, deque

from starlette.types import ASGIApp, Receive, Scope, Send

from app.core.context import request_id_ctx
from app.core.net import client_ip

AUTH_PATH_PREFIX = "/api/v1/auth/"
_STRICT_AUTH_PATHS = ("/api/v1/auth/login", "/api/v1/auth/register")
WINDOW_SECONDS = 60.0


class RateLimitMiddleware:
    """Sliding-window limiter per client IP. Stricter on login/register to slow credential stuffing.

    Counters are held in this process's memory, which is fine for a single API instance. With several
    instances, move them to a shared store (the pattern here stays the same).
    """

    def __init__(self, app: ASGIApp, *, per_minute: int, auth_per_minute: int, proxy_hops: int = 0) -> None:
        self.app = app
        self.proxy_hops = proxy_hops
        self.per_minute = per_minute
        self.auth_per_minute = auth_per_minute
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def _allow(self, key: str, limit: int, now: float) -> float | None:
        """Return None if allowed, otherwise seconds until the next slot frees up."""
        q = self._hits[key]
        while q and now - q[0] > WINDOW_SECONDS:
            q.popleft()
        if len(q) >= limit:
            return WINDOW_SECONDS - (now - q[0])
        q.append(now)
        return None

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or scope["method"] == "OPTIONS" or not scope["path"].startswith("/api/"):
            await self.app(scope, receive, send)
            return
        ip = client_ip(scope, self.proxy_hops)
        now = time.monotonic()
        path = scope["path"]
        wait = self._allow(f"all:{ip}", self.per_minute, now)
        if wait is None and path in _STRICT_AUTH_PATHS and scope["method"] == "POST":
            wait = self._allow(f"auth:{ip}", self.auth_per_minute, now)
        if wait is None:
            await self.app(scope, receive, send)
            return

        retry = max(1, math.ceil(wait))
        body = json.dumps(
            {"error": {"code": "rate_limited", "message": f"Too many requests. Try again in {retry}s.", "request_id": request_id_ctx.get()}}
        ).encode()
        await send(
            {
                "type": "http.response.start",
                "status": 429,
                "headers": [(b"content-type", b"application/json"), (b"retry-after", str(retry).encode()), (b"content-length", str(len(body)).encode())],
            }
        )
        await send({"type": "http.response.body", "body": body})
