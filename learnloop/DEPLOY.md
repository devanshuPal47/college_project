# Deploying LearnLoop to Render

Two services from this repo (defined in `render.yaml`):

| Service | Type | What it is |
|---|---|---|
| `learnloop-api` | Web Service (Python, free) | FastAPI backend. Talks to Supabase Postgres through the pooler. |
| `learnloop-web` | Static Site (free) | The React app, served from Render's CDN. |

The database stays on Supabase, so nothing is stored on Render's disk.

## 0. Before anything else: rotate the Groq key

A real key was committed in `.env.example`. Treat it as public.
1. https://console.groq.com/keys → delete the old key → create a new one.
2. Put the new key in your local `.env` (`GROQ_API_KEY=`). Never paste it into chat or commit it.

## 1. Push this version

```powershell
git add -A
git status          # .env must NOT be listed
git commit -m "Prepare for Render: render.yaml, production settings, deploy docs"
git push
```

## 2. Create both services from the Blueprint

1. https://dashboard.render.com → **New +** → **Blueprint**.
2. Connect GitHub, choose the repo and the `main` branch. Render reads `render.yaml`.
3. Render lists the two services and asks for the variables marked `sync: false`. Fill them like this:

| Service | Variable | Value |
|---|---|---|
| learnloop-api | `DATABASE_URL` | the **Session pooler** URL from Supabase (copy it from your local `.env`; the password is URL-encoded, e.g. `@` → `%40`). No quotes. |
| learnloop-api | `GROQ_API_KEY` | the **new** key |
| learnloop-api | `CORS_ORIGINS` | temporary: `https://example.com` (fixed in step 3) |
| learnloop-web | `VITE_API_URL` | temporary: `https://example.com` (fixed in step 3) |

`JWT_SECRET` is generated for you. Click **Apply**. The first builds take about 3–6 minutes.

## 3. Wire the two URLs together

Each service page shows its public address under the name (`https://….onrender.com`).

1. **learnloop-api → Environment → `CORS_ORIGINS`** = the *web* URL, exactly: `https://<web>.onrender.com` (https, no trailing slash, no path). Save; the API restarts.
2. **learnloop-web → Environment → `VITE_API_URL`** = the *API* URL, exactly: `https://<api>.onrender.com`. Save, then **Manual Deploy → Clear build cache & deploy**. This value is baked into the JavaScript at build time, so the site must be rebuilt after changing it.

## 4. Check that it's really live

```powershell
npm run smoke -- --api https://<api>.onrender.com --web https://<web>.onrender.com
```
Every line should say `PASS`. It creates nothing in your database. The first call after idle can take up to a minute (free tier cold start).

Then open the web URL in a private window, create an account, finish a project, and ask the tutor a question.

## 5. Admin account

The database already has an admin from local development, with a password that has been shared in chat. Replace it:
1. Sign in on the live site as that admin → **Admin** page → **Make admin** on your own account.
2. Sign in as yourself → **Admin** → **Disable** the old `admin@learnloop.local`.

If you ever lock yourself out, reset a password from your machine (hidden prompt, nothing is echoed):
```powershell
npm run set-password -- --email you@example.com --admin
```

## 6. Keep it awake (free tier)

- Render's free API sleeps after 15 minutes without traffic; a cold start can take up to a minute. The app shows a "Waking up the server" message and warms the API as soon as the page opens.
- Supabase free projects pause after about a week without activity.
- A free monitor on https://uptimerobot.com (HTTP(s), every 5 minutes) pointed at `https://<api>.onrender.com/api/v1/health/ready` solves both: it keeps the API awake and touches the database. One always-on free service uses about 744 of Render's 750 free hours per month (the pool is shared across your workspace).

## Troubleshooting

| Symptom | Likely cause and fix |
|---|---|
| Browser console: "blocked by CORS policy" | `CORS_ORIGINS` doesn't match the web URL exactly. Fix it, save, wait for the API to restart. |
| Site loads but every call goes to the wrong place or `localhost` | `VITE_API_URL` was missing at build time. Set it, then **Clear build cache & deploy** the static site. |
| Sign-up/login says "database is unreachable" | `DATABASE_URL` wrong (must be the Session pooler, password URL-encoded) or the Supabase project is paused (resume it). Check `https://<api>.onrender.com/api/v1/health/ready`. |
| First request after a while is very slow | Free-tier cold start. Normal. Use the UptimeRobot monitor above. |
| API deploy fails during start | Open **Logs**. A failed migration or a bad `DATABASE_URL` stops the deploy on purpose, so you never serve a broken schema. |
| Everyone gets "Too many requests" | The API can't see real client IPs. In the logs, each request line ends with `ip=…`. If it shows a proxy address for every request, change `TRUSTED_PROXY_HOPS` (1 → 2). |
| Build fails on Python | `PYTHON_VERSION` is pinned to 3.12.10 in `render.yaml`; confirm it appears under Environment. |

## Updating later

Every push to `main` redeploys both services automatically. Database changes ship as Alembic migrations and are applied when the API starts.

For a fresh database, add `ADMIN_EMAIL` and `ADMIN_PASSWORD` to the API's environment to create the first admin on boot.
