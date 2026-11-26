"""Find the real client IP when the app runs behind reverse proxies (Render, Cloudflare, ...)."""
from starlette.datastructures import Headers
from starlette.types import Scope


def client_ip(scope: Scope, proxy_hops: int = 0) -> str:
    """Return the client's IP address.

    `proxy_hops` is how many trusted reverse proxies sit in front of the app. Each proxy APPENDS the address it saw
    to X-Forwarded-For, so the entries a *client* can forge are on the left and the entries our own proxies add are
    on the right. We therefore count from the right: with 1 hop, the last entry is what our proxy observed.
    Anything further left is ignored, so a forged header can't pick someone else's rate-limit bucket.

    With 0 hops (local dev) the header is ignored entirely and the socket peer is used.
    """
    peer = (scope.get("client") or ("-", 0))[0]
    if proxy_hops <= 0:
        return peer
    forwarded = Headers(scope=scope).get("x-forwarded-for", "")
    parts = [p.strip() for p in forwarded.split(",") if p.strip()]
    return parts[-proxy_hops] if len(parts) >= proxy_hops else peer
