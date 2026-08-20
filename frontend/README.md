# BioPass Admin (frontend)

React admin console for BioPass Community. Built with Vite, Ant Design, and TypeScript. UI template derived from [slash-admin](https://github.com/d3george/slash-admin) (MIT — see root [NOTICE](../NOTICE)).

## Requirements

- Node.js 22+
- pnpm 9.1.0 (see `packageManager` in `package.json`)

## Setup

```bash
cd frontend
pnpm install
pnpm dev               # http://localhost:3031 — proxies /api → http://localhost:3030
```

No frontend `.env` is required — defaults live in `vite.config.ts` (`/api`, homepage, title). Override with a local `.env` only if you need to.

Run the API separately (`backend/`, port **3030**), or use root Docker Compose which serves the built UI from the API on **3030**.

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Vite dev server (port **3031**) |
| `pnpm build` | `tsc` + production build → `dist/` |
| `pnpm preview` | Preview production build |
| `pnpm exec tsc --noEmit` | Typecheck only |
| `pnpm i18n:check` | Locale key parity + static `t()` coverage (all 6 locales) |

## Languages (i18n)

Supported admin UI locales (see `src/locales/`):

| Code | Language | Catalog |
|------|----------|---------|
| `en_US` | English (fallback) | `lang/en_US/` |
| `ko_KR` | Korean | `lang/ko_KR/` |
| `ja_JP` | Japanese | `lang/ja_JP/` |
| `zh_CN` | Simplified Chinese | `lang/zh_CN/` |
| `es_ES` | Spanish | `lang/es_ES/` |
| `fr_FR` | French | `lang/fr_FR/` |

Each locale merges `common.json` + `sys.json`. Wiring: `LocalEnum` → `locale-meta.ts` (Day.js / BCP-47 / browser aliases) → `i18n.ts` → `use-locale.ts` (Ant Design + LocalePicker). After editing strings, run `pnpm i18n:check`.

## Layout

```
frontend/
├── src/
│   ├── api/services/   # HTTP clients
│   ├── components/     # Shared UI
│   ├── layouts/        # Shell / nav
│   ├── pages/          # Route screens
│   ├── router/         # Hash router + modules
│   ├── store/          # Zustand
│   ├── locales/        # i18n (en / ko / ja / zh / es / fr)
│   └── theme/          # Theme tokens
├── public/
└── dist/               # Build output
```

## Notes

- Routing uses **HashRouter** (`/#/setup`, `/#/login`, …).
- Do not reintroduce SaaS-only surfaces; see root [CONTRIBUTING.md](../CONTRIBUTING.md).
- Full stack deploy: root [README.md](../README.md). Env sample: root [`.env.example`](../.env.example) only.
