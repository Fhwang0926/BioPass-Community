<p align="center">
  <img src="docs/assets/logo.png" width="96" alt="BioPass Community" />
</p>

<h1 align="center">BioPass Community</h1>

<p align="center">
  <a href="README.md">English</a> ·
  <a href="README.ko.md">한국어</a>
</p>

<p align="center">
  <strong>Self-hosted biometric MFA for your apps</strong><br/>
  Run the OAuth API and admin console yourself.<br/>
  Users approve logins on their phone with fingerprint or Face ID
  via the <a href="https://apps.apple.com/kr/app/bio-pass/id6760216314">Bio Pass</a> app.
</p>

<p align="center">
  <a href="https://github.com/Fhwang0926/BioPass-Community/releases/latest"><img alt="Latest release" src="https://img.shields.io/github/v/release/Fhwang0926/BioPass-Community" /></a>
  <a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/license-Apache%202.0-blue.svg" /></a>
  <a href="https://apps.apple.com/kr/app/bio-pass/id6760216314"><img alt="App Store" src="https://img.shields.io/badge/App%20Store-Bio%20Pass-0a7cff?logo=apple&logoColor=white" /></a>
</p>

## What this is

| Piece | Role |
|-------|------|
| **This repository** | Self-hosted **server** — OAuth authorize/token, email OTP, admin UI, multi-app management |
| **[Bio Pass](https://apps.apple.com/kr/app/bio-pass/id6760216314)** (App Store) | Companion **mobile app** — receive login requests and approve/deny with biometrics |

Google Play is not published yet.

<p align="center">
  <a href="https://apps.apple.com/kr/app/bio-pass/id6760216314">
    <img src="docs/assets/bio-pass-app-icon.jpg" width="72" alt="Bio Pass app icon" />
  </a>
</p>

<p align="center">
  <img src="docs/assets/flow-download.png" width="170" alt="1. Install Bio Pass" />
  <img src="docs/assets/flow-approve.png" width="170" alt="2. Approve with biometrics" />
  <img src="docs/assets/flow-done.png" width="170" alt="3. Login completes" />
</p>

1. User installs Bio Pass and registers against **your** server (`PUBLIC_BASE_URL`).
2. Your site starts OAuth → user gets a push / deep link → approve with biometrics.
3. Browser returns to your app with `redirect_uri?code=…`.

Email OTP works without the app if SMTP is configured.

## Install

Requires [Docker Compose](https://docs.docker.com/compose/) v2.

```bash
git clone https://github.com/Fhwang0926/BioPass-Community.git
cd BioPass-Community
cp .env.example .env
```

In `.env`, set:

- `AUTH_SECRET` — e.g. `openssl rand -hex 32`
- `POSTGRES_PASSWORD` — strong database password

**Option A — build from source**

```bash
docker compose up --build -d
```

**Option B — pull a release image from GHCR**

Image: `ghcr.io/fhwang0926/biopass-community`  
Latest version: [Releases](https://github.com/Fhwang0926/BioPass-Community/releases/latest)

```bash
# Latest stable (updated only when a v*.*.* tag is published)
docker pull ghcr.io/fhwang0926/biopass-community:latest

# Pin a release (recommended)
docker pull ghcr.io/fhwang0926/biopass-community:0.1.0

IMAGE_TAG=0.1.0 docker compose -f docker-compose.ghcr.yml up -d
```

**Dev preview images** (every push to `dev`):

```bash
docker pull ghcr.io/fhwang0926/biopass-community:dev
docker pull ghcr.io/fhwang0926/biopass-community:dev.20260803   # UTC date snapshot
IMAGE_TAG=dev docker compose -f docker-compose.ghcr.yml up -d
```

Release images are published only from git tags (`vX.Y.Z`). `main` pushes do not publish images.

Open http://localhost:3030 → **`/#/setup`** (first admin) → **`/#/login`**.

Optional: `PUBLIC_BASE_URL`, SMTP, Firebase — see [`.env.example`](.env.example).  
Production checklist: [SECURITY.md](SECURITY.md).

## Use

1. Create an **Application** in the admin console (client id / secret, callback URL).
2. Set `PUBLIC_BASE_URL` to your public HTTPS origin (phones and OAuth clients use this).
3. End users install Bio Pass, sign in with email, and approve MFA prompts.

```text
Your app  →  /api/web/authorize  →  Bio Pass (approve)  →  redirect_uri?code=…
```

Stack: Node.js 22, Koa, PostgreSQL, React (Vite) admin.  
Roles: `ADMIN` / `USER` (console), `APP` (mobile). Single-organization self-host.

## Develop

```bash
docker compose up -d db
cd backend && yarn install && yarn dev     # http://localhost:3030
cd frontend && pnpm install && pnpm dev    # http://localhost:3031 (proxies /api)
```

## License

Apache-2.0 — [LICENSE](LICENSE), [NOTICE](NOTICE).  
[Contributing](CONTRIBUTING.md) · [Code of Conduct](CODE_OF_CONDUCT.md) · [Security](SECURITY.md)
