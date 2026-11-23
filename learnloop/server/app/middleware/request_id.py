import re
import uuid

from starlette.datastructures import Headers, MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.core.context import request_id_ctx

_SAFE = re.compile(r"^[A-Za-z0-9._-]{8,64}$")
HEADER = "X-Request-ID"


class RequestIdMiddleware:
    """Accept a well-formed inbound X-Request-ID (or mint one), expose it to logs and echo it back."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        inbound = Headers(scope=scope).get(HEADER, "")
        rid = inbound if _SAFE.match(inbound) else uuid.uuid4().hex
        request_id_ctx.set(rid)
        scope.setdefault("state", {})["request_id"] = rid

        async def send_with_id(message: Message) -> None:
            if message["type"] == "http.response.start":
                MutableHeaders(scope=message)[HEADER] = rid
            await send(message)

        await self.app(scope, receive, send_with_id)
