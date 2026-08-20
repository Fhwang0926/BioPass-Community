<p align="center">
  <img src="docs/assets/logo.png" width="96" alt="BioPass Community" />
</p>

<h1 align="center">BioPass Community</h1>

<p align="center">
  <a href="README.md">English</a> ·
  <a href="README.ko.md">한국어</a> ·
  <a href="README.ja.md">日本語</a> ·
  <a href="README.zh.md">简体中文</a> ·
  <a href="README.es.md">Español</a> ·
  <a href="README.fr.md">Français</a>
</p>

<p align="center">
  <strong>Self-hosted biometric MFA for your apps</strong><br/>
  Run the OAuth API and admin console on your own infrastructure.<br/>
  End users approve sign-ins with fingerprint or Face ID via
  <a href="https://apps.apple.com/br/app/bio-pass/id6760216314">Bio Pass</a>.
</p>

<p align="center">
  <a href="https://github.com/Fhwang0926/BioPass-Community/releases/latest"><img alt="Latest release" src="https://img.shields.io/github/v/release/Fhwang0926/BioPass-Community?label=release" /></a>
  <a href="https://github.com/Fhwang0926/BioPass-Community/pkgs/container/biopass-community"><img alt="GHCR" src="https://img.shields.io/badge/GHCR-biopass--community-2496ED?logo=docker&logoColor=white" /></a>
  <a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/license-Apache%202.0-blue.svg" /></a>
  <a href="https://apps.apple.com/br/app/bio-pass/id6760216314"><img alt="App Store" src="https://img.shields.io/badge/App%20Store-Bio%20Pass-0a7cff?logo=apple&logoColor=white" /></a>
</p>

## What this is

| Piece | Role |
|-------|------|
| **This repository** | Self-hosted **server** — OAuth authorize/token, email OTP, admin UI, multi-app management |
| **[Bio Pass](https://apps.apple.com/br/app/bio-pass/id6760216314)** | Companion **mobile app** (App Store · iOS 15+) — approve/deny login requests with biometrics |

Google Play is not published yet.

<p align="center">
  <a href="https://apps.apple.com/br/app/bio-pass/id6760216314">
    <img src="docs/assets/logo.png" width="72" alt="BioPass logo" />
  </a>
</p>

<p align="center">
  <img src="docs/assets/flow-download.png" width="170" alt="1. Install Bio Pass" />
  <img src="docs/assets/flow-approve.png" width="170" alt="2. Approve with biometrics" />
  <img src="docs/assets/flow-done.png" width="170" alt="3. Login completes" />
</p>

1. Install Bio Pass and register against **your** server (`PUBLIC_BASE_URL`). The app probes `GET /api/app/check-site` on that origin, then signs up.
2. Your app starts OAuth → push / deep link → approve with biometrics.
3. Browser returns to your app with `redirect_uri?code=…`.

Email OTP works without the mobile app if SMTP is configured.

## Install

Needs [Docker Compose](https://docs.docker.com/compose/) v2.

```bash
git clone https://github.com/Fhwang0926/BioPass-Community.git
cd BioPass-Community
cp .env.example .env
```

Set required values in `.env`:

- `AUTH_SECRET` — `openssl rand -hex 32`
- `POSTGRES_PASSWORD` — strong database password

### A) Build from source

```bash
docker compose up --build -d
```

### B) Pull from GHCR

Image: [`ghcr.io/fhwang0926/biopass-community`](https://github.com/Fhwang0926/BioPass-Community/pkgs/container/biopass-community)  
Check the current version on [Releases](https://github.com/Fhwang0926/BioPass-Community/releases/latest) (badge above).

| Tag | When it is published |
|-----|----------------------|
| `latest`, `X.Y.Z`, `X.Y` | Git tag `vX.Y.Z` only |
| `dev`, `dev.YYYYMMDD` | Every push to the `dev` branch (UTC date) |

`main` pushes do **not** publish images.

```bash
# Stable (pin a release — recommended)
docker pull ghcr.io/fhwang0926/biopass-community:latest
docker pull ghcr.io/fhwang0926/biopass-community:0.1.0

IMAGE_TAG=0.1.0 docker compose -f docker-compose.ghcr.yml up -d

# Dev preview
docker pull ghcr.io/fhwang0926/biopass-community:dev
IMAGE_TAG=dev docker compose -f docker-compose.ghcr.yml up -d
```

Open http://localhost:3030 → **`/#/setup`** → **`/#/login`**.

Optional env (`PUBLIC_BASE_URL`, SMTP, Firebase): [`.env.example`](.env.example).  
Production hardening: [SECURITY.md](SECURITY.md).

### Publish a release image

```bash
git tag v0.2.0
git push origin v0.2.0
# → GHCR tags: 0.2.0, 0.2, latest
```

## Use

1. Create an **Application** in the admin console (client id / secret, callback URL).
2. Set `PUBLIC_BASE_URL` to your public HTTPS origin.
3. Users install Bio Pass, sign in with email, and approve MFA prompts.

```text
Your app  →  /api/web/authorize  →  Bio Pass (approve)  →  redirect_uri?code=…
```

Stack: Node.js 22 · Koa · PostgreSQL · React (Vite) admin.  
Roles: `ADMIN` / `USER` (console), `APP` (mobile). Single-organization self-host.

## Admin UI languages

The admin console is localized in six locales (picker in the header / public pages):

| Locale | Language |
|--------|----------|
| `en_US` | English (fallback) |
| `ko_KR` | Korean |
| `ja_JP` | Japanese |
| `zh_CN` | Simplified Chinese |
| `es_ES` | Spanish |
| `fr_FR` | French |

Preference is stored in `localStorage` (`i18nextLng`). On first visit, the browser language is used when it matches a supported locale (e.g. `ja` → `ja_JP`, `zh` / `zh-TW` → `zh_CN`). Catalogs live under [`frontend/src/locales/lang/`](frontend/src/locales/lang/); keep key parity with `cd frontend && pnpm i18n:check`.

Legal document **bodies** are Korean or English only (non-`ko_KR` → English). Developer code samples follow the same rule.

## Develop

```bash
docker compose up -d db
cd backend && yarn install && yarn dev     # http://localhost:3030
cd frontend && pnpm install && pnpm dev    # http://localhost:3031 (proxies /api)
```

## License

Apache-2.0 — [LICENSE](LICENSE), [NOTICE](NOTICE).  
[Contributing](CONTRIBUTING.md) · [Code of Conduct](CODE_OF_CONDUCT.md) · [Security](SECURITY.md)
