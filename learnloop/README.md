# LearnLoop

Learn web development by building small projects: guided onboarding, roadmap, automated checks, AI feedback, XP and streaks.

**Stack:** React + Vite + Tailwind v4 + React Flow + CodeMirror · FastAPI (Python venv) · SQLAlchemy + Alembic · Supabase Postgres (via the pooler) · JWT auth with RBAC · Groq.

All data lives in Supabase Postgres. Nothing about a learner's progress is stored locally; the browser only keeps the session tokens.

## Run

```powershell
npm install
npm run setup          # creates server\.venv and installs Python packages
# .env at the repo root (see .env.example): DATABASE_URL, JWT_SECRET, GROQ_API_KEY, ADMIN_EMAIL, ADMIN_PASSWORD
npm run db:upgrade     # applies Alembic migrations to Supabase
npm run dev            # web http://localhost:5173  ·  API http://localhost:8787 (docs: /api/docs)
```

Separately: `npm run dev:api` (API in the venv) and `npm run dev:web`.

| Command | What it does |
|---|---|
| `npm run db:upgrade` | Apply migrations (`alembic upgrade head`) |
| `npm run db:downgrade` | Roll back one migration |
| `npm run db:revision -- "message"` | Autogenerate a migration from model changes |
| `npm run db:current` | Show the applied revision |
| `npm run test:api` | Backend tests (DB-backed tests run against Supabase) |

## Deploy

See **[DEPLOY.md](DEPLOY.md)** for the exact Render steps (`render.yaml` defines both services). After deploying: `npm run smoke -- --api <api-url> --web <web-url>`.

## Backend layout (`server/app`)

```
core/        config (pydantic-settings), security (bcrypt, JWT), logging, errors, request context
db/          declarative base (naming conventions), engine/session
models/      User, RefreshToken, UserProgress, AiUsage
schemas/     Pydantic request/response models
services/    business logic: users, tokens, progress, usage, ai
api/         deps (current user, role guards) and v1 routes: health, auth, progress, ai, admin
middleware/  request-id, access log, security headers, rate limit (+ CORS in main.py)
```

Auth: short-lived access JWT + rotating refresh JWT tracked in the database (logout, reuse detection, instant revoke on disable). Roles: `user`, `admin`; the role is always read from the database, never trusted from the token. Self-signup creates `user`; the bootstrap admin comes from `ADMIN_EMAIL`/`ADMIN_PASSWORD`.

Every error uses one envelope: `{"error": {"code", "message", "request_id"}}`.

## Frontend layout (`src`)

`data/` roadmap, projects, onboarding content · `lib/` api client, auth, progress sync, checks, recommender · `pages/` Onboarding, Login, Plan, Home, Roadmap, Workspace, Portfolio, Admin · `components/`
