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
  <strong>MFA biométrique auto-hébergée pour vos applications</strong><br/>
  Exécutez l’API OAuth et la console d’administration sur votre propre infrastructure.<br/>
  Les utilisateurs finaux approuvent les connexions par empreinte ou Face ID via
  <a href="https://apps.apple.com/br/app/bio-pass/id6760216314">Bio Pass</a>.
</p>

<p align="center">
  <a href="https://github.com/Fhwang0926/BioPass-Community/releases/latest"><img alt="Dernière version" src="https://img.shields.io/github/v/release/Fhwang0926/BioPass-Community?label=release" /></a>
  <a href="https://github.com/Fhwang0926/BioPass-Community/pkgs/container/biopass-community"><img alt="GHCR" src="https://img.shields.io/badge/GHCR-biopass--community-2496ED?logo=docker&logoColor=white" /></a>
  <a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/license-Apache%202.0-blue.svg" /></a>
  <a href="https://apps.apple.com/br/app/bio-pass/id6760216314"><img alt="App Store" src="https://img.shields.io/badge/App%20Store-Bio%20Pass-0a7cff?logo=apple&logoColor=white" /></a>
</p>

## De quoi s’agit-il

| Élément | Rôle |
|---------|------|
| **Ce dépôt** | **Serveur** auto-hébergé — autorisation/jeton OAuth, OTP e-mail, interface d’administration, gestion multi-applications |
| **[Bio Pass](https://apps.apple.com/br/app/bio-pass/id6760216314)** | Application **mobile** associée (App Store · iOS 15+) — approuver/refuser les demandes de connexion par biométrie |

Google Play n’est pas encore publié.

<p align="center">
  <a href="https://apps.apple.com/br/app/bio-pass/id6760216314">
    <img src="docs/assets/logo.png" width="72" alt="Logo BioPass" />
  </a>
</p>

<p align="center">
  <img src="docs/assets/flow-download.png" width="170" alt="1. Installer Bio Pass" />
  <img src="docs/assets/flow-approve.png" width="170" alt="2. Approuver avec la biométrie" />
  <img src="docs/assets/flow-done.png" width="170" alt="3. Connexion terminée" />
</p>

1. Installez Bio Pass et enregistrez-vous sur **votre** serveur (`PUBLIC_BASE_URL`). L’application interroge `GET /api/app/check-site` sur cette origine, puis s’inscrit.
2. Votre application lance OAuth → notification push / lien profond → approbation biométrique.
3. Le navigateur revient vers votre application avec `redirect_uri?code=…`.

L’OTP e-mail fonctionne sans l’application mobile si SMTP est configuré.

## Installation

[Docker Compose](https://docs.docker.com/compose/) v2 est requis.

```bash
git clone https://github.com/Fhwang0926/BioPass-Community.git
cd BioPass-Community
cp .env.example .env
```

Définissez les valeurs obligatoires dans `.env` :

- `AUTH_SECRET` — `openssl rand -hex 32`
- `POSTGRES_PASSWORD` — un mot de passe de base de données suffisamment fort

### A) Compiler depuis les sources

```bash
docker compose up --build -d
```

### B) Télécharger depuis GHCR

Image : [`ghcr.io/fhwang0926/biopass-community`](https://github.com/Fhwang0926/BioPass-Community/pkgs/container/biopass-community)  
Consultez la version actuelle sur [Releases](https://github.com/Fhwang0926/BioPass-Community/releases/latest) (badge ci-dessus).

| Tag | Quand il est publié |
|-----|---------------------|
| `latest`, `X.Y.Z`, `X.Y` | Uniquement avec le tag git `vX.Y.Z` |
| `dev`, `dev.YYYYMMDD` | À chaque push sur la branche `dev` (date UTC) |

Les push sur `main` ne publient **pas** d’images.

```bash
# Version stable (épingler une version — recommandé)
docker pull ghcr.io/fhwang0926/biopass-community:latest
docker pull ghcr.io/fhwang0926/biopass-community:0.1.0

IMAGE_TAG=0.1.0 docker compose -f docker-compose.ghcr.yml up -d

# Aperçu de développement
docker pull ghcr.io/fhwang0926/biopass-community:dev
IMAGE_TAG=dev docker compose -f docker-compose.ghcr.yml up -d
```

Ouvrez http://localhost:3030 → **`/#/setup`** → **`/#/login`**.

Variables optionnelles (`PUBLIC_BASE_URL`, SMTP, Firebase) : [`.env.example`](.env.example).  
Renforcement en production : [SECURITY.md](SECURITY.md).

### Publier une image de version

```bash
git tag v0.2.0
git push origin v0.2.0
# → tags GHCR : 0.2.0, 0.2, latest
```

## Utilisation

1. Créez une **Application** dans la console d’administration (client id / secret, URL de callback).
2. Définissez `PUBLIC_BASE_URL` sur votre origine HTTPS publique.
3. Les utilisateurs installent Bio Pass, se connectent par e-mail et approuvent les demandes MFA.

```text
Votre app  →  /api/web/authorize  →  Bio Pass (approuver)  →  redirect_uri?code=…
```

Pile : Node.js 22 · Koa · PostgreSQL · console React (Vite).  
Rôles : `ADMIN` / `USER` (console), `APP` (mobile). Auto-hébergement d’une seule organisation.

## Langues de la console

La console d’administration est localisée en six locales (sélecteur dans l’en-tête / les pages publiques) :

| Locale | Langue |
|--------|--------|
| `en_US` | Anglais (repli) |
| `ko_KR` | Coréen |
| `ja_JP` | Japonais |
| `zh_CN` | Chinois simplifié |
| `es_ES` | Espagnol |
| `fr_FR` | Français |

La préférence est enregistrée dans `localStorage` (`i18nextLng`). Lors de la première visite, la langue du navigateur est utilisée si elle correspond à une locale prise en charge (ex. `ja` → `ja_JP`, `zh` / `zh-TW` → `zh_CN`). Les catalogues se trouvent dans [`frontend/src/locales/lang/`](frontend/src/locales/lang/) ; conservez la parité des clés avec `cd frontend && pnpm i18n:check`.

Le **corps** des documents juridiques n’existe qu’en coréen ou en anglais (hors `ko_KR` → anglais). Les exemples de code pour développeurs suivent la même règle.

## Développement

```bash
docker compose up -d db
cd backend && yarn install && yarn dev     # http://localhost:3030
cd frontend && pnpm install && pnpm dev    # http://localhost:3031 (proxy /api)
```

## Licence

Apache-2.0 — [LICENSE](LICENSE), [NOTICE](NOTICE).  
[Contribuer](CONTRIBUTING.md) · [Code de conduite](CODE_OF_CONDUCT.md) · [Sécurité](SECURITY.md)
