# BioPass Community — API server

Node.js API for the self-hosted biometric MFA / OAuth platform.

## Requirements

- Node.js 22+
- PostgreSQL 16+

## Setup

```bash
cd backend
# Optional: use repo-root .env (AUTH_SECRET). DATABASE_URL defaults to local biopass.
yarn install           # yarn.lock is the canonical lockfile (npm also works)
yarn db:push           # sync schema from model/ (or just start the server — it syncs on boot)
yarn dev               # http://localhost:3030
```

From the repo root: `npm run dev` / `npm run db:push` (delegates to `backend/`). Env sample: root [`.env.example`](../.env.example) only (`cp .env.example .env`).

**First admin:** with an empty database, open http://localhost:3030/#/setup (or set `INIT_ADMIN_EMAIL` + `INIT_ADMIN_PASSWORD` before start). Full Docker install steps: root [README.md — First-time installation](../README.md#first-time-installation).

## Environment

Use the **repo-root** [`.env.example`](../.env.example) (`AUTH_SECRET`). Local DB defaults to `postgresql://biopass:biopass@localhost:5432/biopass` when unset.

| | |
|---|---|
| Required (prod / Compose) | `AUTH_SECRET` |
| Auto | Schema sync on boot (`db:push`; production omits `--force` unless `ALLOW_SCHEMA_FORCE=1`), `/#/setup` latch, CORS from `PUBLIC_BASE_URL` / `CORS_ORIGINS` |
| Off until configured | SMTP (`SMTP_HOST` + credentials), Firebase JSON under `json/` |
| Optional | `TRUST_PROXY`, `AUTH_ACCESS_APP` (default `1d`), `POSTGRES_PASSWORD`, `API_HOST_BIND`, `BIOPASS_IMAGE` |

Passwords are stored with **scrypt** (legacy SHA-512 hashes still verify and rehash on login).

For production upgrades, prefer `SKIP_AUTO_SCHEMA_SYNC=1` and run `yarn db:push` deliberately after reviewing model changes.

Optional integrations stay disabled until you add credentials (no extra env sample files). Organization (`sys_company`) scopes apps and users for self-hosted multi-team use — not a commercial billing feature.

Docker Compose injects `DATABASE_URL` for you.

## Database schema

Schema is defined in `model/schema/` and applied with **Drizzle Kit push** (no SQL migration history in this edition).

```bash
yarn db:push    # sync tables/indexes to match the current models
```

On server start the API runs the same sync automatically unless `SKIP_AUTO_SCHEMA_SYNC=1` (or legacy alias `SKIP_AUTO_MIGRATE=1`).

Runtime database is always **PostgreSQL**.

Swagger UI (`/api-docs`) documents core `/api/app` and `/api/web` routes from `docs/service_*.yaml` (dev by default; `ENABLE_SWAGGER=1` in production).

Push notifications: place a real Firebase service-account JSON under `json/` (see `json/firebase-service-account.example.json`).

## Layout

```
backend/
├── api/           # Koa routes (sys / service/web / service/app / log)
├── docs/          # OpenAPI YAML (Swagger UI)
├── lib/           # DB, mail, template helpers
├── model/         # Drizzle schema
├── service/       # Shared domain services
├── templates/     # Auth HTML templates
├── util/          # Init + helpers
├── json/          # Optional Firebase service-account JSON (not committed)
└── wwwroot/       # Built admin UI (produced by Docker / production build — not in source)
```

Web / app integration flows: [api/service/readme.md](api/service/readme.md).

## Notes

- Do not commit `.env` or real Firebase service-account JSON under `json/`.
- Commercial SaaS surfaces (billing, hosting, Polar) are not part of this edition.
