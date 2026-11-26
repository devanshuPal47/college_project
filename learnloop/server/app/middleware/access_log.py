import logging
import time

from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.core.net import client_ip

logger = logging.getLogger("app.access")


class AccessLogMiddleware:
    """One structured line per request: method, path, status, duration, client."""

    def __init__(self, app: ASGIApp, *, proxy_hops: int = 0) -> None:
        self.app = app
        self.proxy_hops = proxy_hops

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        start = time.perf_counter()
        status = 500

        async def capture(message: Message) -> None:
            nonlocal status
            if message["type"] == "http.response.start":
                status = message["status"]
            await send(message)

        try:
            await self.app(scope, receive, capture)
        finally:
            ms = (time.perf_counter() - start) * 1000
            level = logging.WARNING if status >= 500 else logging.INFO
            logger.log(level, "%s %s -> %s in %.0fms (ip=%s)", scope["method"], scope["path"], status, ms, client_ip(scope, self.proxy_hops))
