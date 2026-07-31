# Contributing to BioPass Community

Thanks for helping improve this project.

## Development setup

1. Install Node.js 22+ (frontend uses **pnpm 9.1**; backend lockfile is **yarn**)
2. Start Postgres (`docker compose up -d db`)
3. `cp .env.example .env` and set `AUTH_SECRET` (repo root — used by Compose and local API)
4. Sync the DB schema (`yarn db:push` in `backend/`, or start the server — it syncs on boot) and run `yarn dev`
5. Run the admin UI with `pnpm dev` in `frontend/` (http://localhost:3031 → proxies `/api` to `:3030`)

For a full stack try: `cp .env.example .env` (set `AUTH_SECRET`) then `docker compose up --build`

See the root [README.md](README.md) for Docker Compose, GHCR, and role notes.

## Git hooks (lefthook)

Hooks live in the repo-root [`lefthook.yml`](lefthook.yml) (installs into `.git/hooks` after `pnpm install` in `frontend/`, or `npm run hooks:install` at the root).

- **pre-commit:** frontend Biome format/lint + `tsc`; backend `node --check` on staged JS
- **commit-msg:** Conventional Commits via commitlint (`frontend/`)
- Skip once: `LEFTHOOK=0 git commit …` or `git commit --no-verify`

## Pull requests

- Keep changes focused; prefer small PRs
- Do not commit secrets, `.env`, or credential JSON files
- Do not reintroduce commercial SaaS surfaces (billing/Polar, hosting console, vendor QnA/FAQ)
- This project is Apache-2.0; keep NOTICE attributions intact when redistributing
- Update docs when behavior or env vars change
- Run frontend typecheck (`pnpm exec tsc --noEmit`) when touching TypeScript

## Code of conduct

Please read and follow the [Code of Conduct](CODE_OF_CONDUCT.md).
Be respectful and constructive. Harassment or abusive behavior is not acceptable.

## Issues

Use the GitHub issue templates under **New issue**:

- **Bug report** — broken API, admin UI, or Docker behavior
- **Feature request** — self-hosted Community improvements (SaaS reintroductions are out of scope)
- **Documentation** — README / setup / contributor docs

Security vulnerabilities: see [SECURITY.md](SECURITY.md) (private report only).
