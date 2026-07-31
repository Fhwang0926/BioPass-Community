# Security Policy

## Supported versions

Security fixes are accepted against the **default branch** of this repository
(typically `main` once published). Active development may happen on `dev`;
please cherry-pick or open security PRs so they land on the default/release
branch.

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

Prefer one of:

1. [GitHub private security advisory](https://github.com/Fhwang0926/BioPass-Community/security/advisories/new) on this repository
2. Contact the repository maintainers privately (GitHub account that owns the repo)

Include:

- Affected version / commit / image tag
- Reproduction steps
- Impact assessment
- Any suggested fix

We will acknowledge reports as soon as practical and coordinate a fix or disclosure timeline.

> `CONTACT_EMAIL` / `MAINTENANCE_EMAIL` in deployment config are operator-facing metadata, **not** a project vulnerability inbox.

## Self-hosting checklist

- Set a strong `AUTH_SECRET` (`openssl rand -hex 32`)
- Complete initial admin setup at `/#/setup` (or seed with `INIT_ADMIN_EMAIL` + `INIT_ADMIN_PASSWORD`)
- Set a strong `POSTGRES_PASSWORD` (Compose requires it; keep `DATABASE_URL` in sync)
- Keep the API on loopback (`API_HOST_BIND=127.0.0.1`, Compose default) and terminate TLS on a reverse proxy
- Set `CORS_ORIGINS` / `PUBLIC_BASE_URL` to your real origin(s)
- Set `TRUST_PROXY=1` only when behind a trusted reverse proxy
- Prefer reverse-proxy rate limits in addition to the built-in API limits
- For production upgrades, prefer `SKIP_AUTO_SCHEMA_SYNC=1` and run `yarn db:push` deliberately; avoid `ALLOW_SCHEMA_FORCE=1` unless you accept destructive schema changes
- Restrict network access to the admin console
- Keep PostgreSQL and Node.js updated
- Do not commit `.env`, Firebase credentials, or OAuth client secrets
- Use `backend/json/firebase-service-account.example.json` as a template only — never commit real service-account keys
