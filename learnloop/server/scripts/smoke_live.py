"""Non-destructive checks for a deployed LearnLoop. Creates no accounts and writes nothing.

    npm run smoke -- --api https://learnloop-api.onrender.com --web https://learnloop-web.onrender.com

Exit code 0 only if every check passes. Run it after each deploy.
"""
import argparse
import re
import sys
import time

import httpx

results: list[bool] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    results.append(ok)
    print(f"{'PASS' if ok else 'FAIL'}  {name}" + (f"  ({detail})" if detail else ""))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--api", required=True, help="backend base URL, e.g. https://learnloop-api.onrender.com")
    ap.add_argument("--web", help="frontend URL; also used as the browser origin for the CORS check")
    ap.add_argument("--origin", help="browser origin to test CORS with (defaults to --web)")
    a = ap.parse_args()
    api = a.api.rstrip("/")
    origin = (a.origin or a.web or "").rstrip("/")
    https = api.startswith("https://")
    c = httpx.Client(timeout=90, follow_redirects=False)

    # 1. liveness (and cold-start time: a sleeping free instance can take ~a minute)
    t = time.perf_counter()
    try:
        r = c.get(f"{api}/api/v1/health")
    except httpx.HTTPError as e:
        print(f"FAIL  API not reachable: {type(e).__name__}. Is the service deployed and awake? ({api})")
        return 1
    took = time.perf_counter() - t
    check("API liveness /health", r.status_code == 200 and r.json() == {"status": "ok"}, f"{r.status_code}, {took:.1f}s{' (cold start)' if took > 8 else ''}")

    # 2. readiness: database reachable, migrations applied, AI key present
    r = c.get(f"{api}/api/v1/health/ready")
    j = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
    check("database reachable + migrated", r.status_code == 200 and j.get("database") == "ok" and bool(j.get("migration")), f"migration={j.get('migration')}" if r.status_code == 200 else f"{r.status_code} {j.get('error', {}).get('code', '')}")
    check("AI key configured", j.get("ai_configured") is True)

    # 3. hardening
    h = r.headers
    check("security headers present", h.get("x-content-type-options") == "nosniff" and h.get("x-frame-options") == "DENY")
    check("HSTS on (production over https)", (not https) or "max-age" in h.get("strict-transport-security", ""))
    check("API docs hidden in production", c.get(f"{api}/api/docs").status_code == 404)
    check("request id echoed", bool(h.get("x-request-id")))

    # 4. auth is enforced
    r = c.get(f"{api}/api/v1/auth/me")
    check("protected route needs a token (401)", r.status_code == 401 and r.json().get("error", {}).get("code") == "not_authenticated")

    # 5. CORS: the browser at --web may call the API, a stranger may not
    if origin:
        def preflight(o: str) -> httpx.Response:
            return c.options(f"{api}/api/v1/auth/login", headers={"Origin": o, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "authorization,content-type"})
        ok = preflight(origin)
        check(f"CORS allows your frontend ({origin})", ok.headers.get("access-control-allow-origin") == origin, "set CORS_ORIGINS on the API to this exact URL" if ok.headers.get("access-control-allow-origin") != origin else "")
        check("CORS blocks other sites", "access-control-allow-origin" not in preflight("https://evil.example").headers)

    # 6. frontend
    if a.web:
        web = a.web.rstrip("/")
        r = c.get(web + "/", follow_redirects=True)
        check("frontend serves the app", r.status_code == 200 and 'id="root"' in r.text, str(r.status_code))
        m = re.search(r'src="(/assets/[^"]+\.js)"', r.text)
        if m:
            js = c.get(web + m.group(1)).text
            check("frontend bundle points at THIS API (VITE_API_URL)", api in js, "rebuild the static site after setting VITE_API_URL" if api not in js else "")
        else:
            check("frontend bundle found", False, "no /assets/*.js in index.html")

    print(f"\n{sum(results)}/{len(results)} checks passed")
    return 0 if all(results) else 1


if __name__ == "__main__":
    sys.exit(main())
