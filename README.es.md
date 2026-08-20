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
  <strong>MFA biométrica autoalojada para tus aplicaciones</strong><br/>
  Ejecuta la API OAuth y la consola de administración en tu propia infraestructura.<br/>
  Los usuarios finales aprueban los inicios de sesión con huella o Face ID mediante
  <a href="https://apps.apple.com/br/app/bio-pass/id6760216314">Bio Pass</a>.
</p>

<p align="center">
  <a href="https://github.com/Fhwang0926/BioPass-Community/releases/latest"><img alt="Última versión" src="https://img.shields.io/github/v/release/Fhwang0926/BioPass-Community?label=release" /></a>
  <a href="https://github.com/Fhwang0926/BioPass-Community/pkgs/container/biopass-community"><img alt="GHCR" src="https://img.shields.io/badge/GHCR-biopass--community-2496ED?logo=docker&logoColor=white" /></a>
  <a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/license-Apache%202.0-blue.svg" /></a>
  <a href="https://apps.apple.com/br/app/bio-pass/id6760216314"><img alt="App Store" src="https://img.shields.io/badge/App%20Store-Bio%20Pass-0a7cff?logo=apple&logoColor=white" /></a>
</p>

## Qué es esto

| Pieza | Función |
|-------|---------|
| **Este repositorio** | **Servidor** autoalojado — autorización/token OAuth, OTP por correo, UI de administración, gestión de varias apps |
| **[Bio Pass](https://apps.apple.com/br/app/bio-pass/id6760216314)** | **App móvil** complementaria (App Store · iOS 15+) — aprobar/denegar solicitudes de inicio de sesión con biometría |

Google Play aún no está publicado.

<p align="center">
  <a href="https://apps.apple.com/br/app/bio-pass/id6760216314">
    <img src="docs/assets/logo.png" width="72" alt="Logotipo de BioPass" />
  </a>
</p>

<p align="center">
  <img src="docs/assets/flow-download.png" width="170" alt="1. Instalar Bio Pass" />
  <img src="docs/assets/flow-approve.png" width="170" alt="2. Aprobar con biometría" />
  <img src="docs/assets/flow-done.png" width="170" alt="3. Inicio de sesión completado" />
</p>

1. Instala Bio Pass y regístrate en **tu** servidor (`PUBLIC_BASE_URL`). La app comprueba `GET /api/app/check-site` en ese origen y después se registra.
2. Tu app inicia OAuth → push / enlace profundo → aprobación con biometría.
3. El navegador vuelve a tu app con `redirect_uri?code=…`.

El OTP por correo funciona sin la app móvil si SMTP está configurado.

## Instalación

Se necesita [Docker Compose](https://docs.docker.com/compose/) v2.

```bash
git clone https://github.com/Fhwang0926/BioPass-Community.git
cd BioPass-Community
cp .env.example .env
```

Define los valores obligatorios en `.env`:

- `AUTH_SECRET` — `openssl rand -hex 32`
- `POSTGRES_PASSWORD` — una contraseña de base de datos robusta

### A) Compilar desde el código fuente

```bash
docker compose up --build -d
```

### B) Descargar desde GHCR

Imagen: [`ghcr.io/fhwang0926/biopass-community`](https://github.com/Fhwang0926/BioPass-Community/pkgs/container/biopass-community)  
Consulta la versión actual en [Releases](https://github.com/Fhwang0926/BioPass-Community/releases/latest) (insignia superior).

| Etiqueta | Cuándo se publica |
|----------|-------------------|
| `latest`, `X.Y.Z`, `X.Y` | Solo con la etiqueta git `vX.Y.Z` |
| `dev`, `dev.YYYYMMDD` | En cada push a la rama `dev` (fecha UTC) |

Los push a `main` **no** publican imágenes.

```bash
# Versión estable (se recomienda fijar la versión)
docker pull ghcr.io/fhwang0926/biopass-community:latest
docker pull ghcr.io/fhwang0926/biopass-community:0.1.0

IMAGE_TAG=0.1.0 docker compose -f docker-compose.ghcr.yml up -d

# Vista previa de desarrollo
docker pull ghcr.io/fhwang0926/biopass-community:dev
IMAGE_TAG=dev docker compose -f docker-compose.ghcr.yml up -d
```

Abre http://localhost:3030 → **`/#/setup`** → **`/#/login`**.

Variables opcionales (`PUBLIC_BASE_URL`, SMTP, Firebase): [`.env.example`](.env.example).  
Endurecimiento en producción: [SECURITY.md](SECURITY.md).

### Publicar una imagen de versión

```bash
git tag v0.2.0
git push origin v0.2.0
# → etiquetas GHCR: 0.2.0, 0.2, latest
```

## Uso

1. Crea una **Application** en la consola de administración (client id / secret, URL de callback).
2. Establece `PUBLIC_BASE_URL` en tu origen HTTPS público.
3. Los usuarios instalan Bio Pass, inician sesión con el correo y aprueban las solicitudes MFA.

```text
Tu app  →  /api/web/authorize  →  Bio Pass (aprobar)  →  redirect_uri?code=…
```

Stack: Node.js 22 · Koa · PostgreSQL · consola React (Vite).  
Roles: `ADMIN` / `USER` (consola), `APP` (móvil). Autoalojamiento de una sola organización.

## Idiomas de la consola

La consola de administración está localizada en seis locales (selector en la cabecera / páginas públicas):

| Locale | Idioma |
|--------|--------|
| `en_US` | Inglés (reserva) |
| `ko_KR` | Coreano |
| `ja_JP` | Japonés |
| `zh_CN` | Chino simplificado |
| `es_ES` | Español |
| `fr_FR` | Francés |

La preferencia se guarda en `localStorage` (`i18nextLng`). En la primera visita se usa el idioma del navegador si coincide con un locale compatible (p. ej. `ja` → `ja_JP`, `zh` / `zh-TW` → `zh_CN`). Los catálogos están en [`frontend/src/locales/lang/`](frontend/src/locales/lang/); mantén la paridad de claves con `cd frontend && pnpm i18n:check`.

El **cuerpo** de los documentos legales solo está en coreano o inglés (si no es `ko_KR` → inglés). Las muestras de código para desarrolladores siguen la misma regla.

## Desarrollo

```bash
docker compose up -d db
cd backend && yarn install && yarn dev     # http://localhost:3030
cd frontend && pnpm install && pnpm dev    # http://localhost:3031 (proxy de /api)
```

## Licencia

Apache-2.0 — [LICENSE](LICENSE), [NOTICE](NOTICE).  
[Contribuir](CONTRIBUTING.md) · [Código de conducta](CODE_OF_CONDUCT.md) · [Seguridad](SECURITY.md)
