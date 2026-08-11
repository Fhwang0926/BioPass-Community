<p align="center">
  <img src="docs/assets/logo.png" width="96" alt="BioPass Community" />
</p>

<h1 align="center">BioPass Community</h1>

<p align="center">
  <a href="README.md">English</a> ·
  <a href="README.ko.md">한국어</a>
</p>

<p align="center">
  <strong>직접 운영하는 생체인증 MFA / OAuth</strong><br/>
  OAuth API와 관리자 콘솔을 직접 호스팅합니다.<br/>
  사용자는 <a href="https://apps.apple.com/kr/app/bio-pass/id6760216314">Bio Pass</a> 앱에서
  지문·Face ID로 로그인을 승인합니다.
</p>

<p align="center">
  <a href="https://github.com/Fhwang0926/BioPass-Community/releases/latest"><img alt="최신 릴리즈" src="https://img.shields.io/github/v/release/Fhwang0926/BioPass-Community" /></a>
  <a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/license-Apache%202.0-blue.svg" /></a>
  <a href="https://apps.apple.com/kr/app/bio-pass/id6760216314"><img alt="App Store" src="https://img.shields.io/badge/App%20Store-Bio%20Pass-0a7cff?logo=apple&logoColor=white" /></a>
</p>

## 구성

| 구성 | 역할 |
|------|------|
| **이 저장소** | 셀프호스팅 **서버** — OAuth 인가/토큰, 이메일 OTP, 관리자 UI, 다중 앱 관리 |
| **[Bio Pass](https://apps.apple.com/kr/app/bio-pass/id6760216314)** (App Store) | 연동 **모바일 앱** — 로그인 요청을 받아 생체인증으로 승인/거절 |

Google Play는 아직 출시되지 않았습니다.

<p align="center">
  <a href="https://apps.apple.com/kr/app/bio-pass/id6760216314">
    <img src="docs/assets/bio-pass-app-icon.jpg" width="72" alt="Bio Pass 앱 아이콘" />
  </a>
</p>

<p align="center">
  <img src="docs/assets/flow-download.png" width="170" alt="1. Bio Pass 설치" />
  <img src="docs/assets/flow-approve.png" width="170" alt="2. 생체인증 승인" />
  <img src="docs/assets/flow-done.png" width="170" alt="3. 로그인 완료" />
</p>

1. 사용자가 Bio Pass를 설치하고 **여러분 서버**(`PUBLIC_BASE_URL`)에 등록합니다.
2. 서비스가 OAuth를 시작하면 푸시/딥링크로 요청이 오고, 생체인증으로 승인합니다.
3. 브라우저가 `redirect_uri?code=…` 로 돌아와 로그인이 완료됩니다.

SMTP를 설정하면 앱 없이도 이메일 OTP로 로그인할 수 있습니다.

## 설치

[Docker Compose](https://docs.docker.com/compose/) v2가 필요합니다.

```bash
git clone https://github.com/Fhwang0926/BioPass-Community.git
cd BioPass-Community
cp .env.example .env
```

`.env`에 다음을 설정합니다.

- `AUTH_SECRET` — 예: `openssl rand -hex 32`
- `POSTGRES_PASSWORD` — 강한 DB 비밀번호

**A) 소스에서 빌드**

```bash
docker compose up --build -d
```

**B) GHCR에서 릴리즈 이미지 pull**

이미지: `ghcr.io/fhwang0926/biopass-community`  
최신 버전: [Releases](https://github.com/Fhwang0926/BioPass-Community/releases/latest)

```bash
# 최신 안정 버전 (v*.*.* 태그가 올라올 때만 갱신)
docker pull ghcr.io/fhwang0926/biopass-community:latest

# 버전 고정 (권장)
docker pull ghcr.io/fhwang0926/biopass-community:0.1.0

IMAGE_TAG=0.1.0 docker compose -f docker-compose.ghcr.yml up -d
```

**개발용 이미지** (`dev` 브랜치 푸시마다 빌드):

```bash
docker pull ghcr.io/fhwang0926/biopass-community:dev
docker pull ghcr.io/fhwang0926/biopass-community:dev.20260803   # UTC 날짜 스냅샷
IMAGE_TAG=dev docker compose -f docker-compose.ghcr.yml up -d
```

릴리즈 이미지는 git 태그(`vX.Y.Z`)일 때만 배포됩니다. `main` 푸시만으로는 이미지가 올라가지 않습니다.

http://localhost:3030 접속 → **`/#/setup`** (최초 관리자) → **`/#/login`**.

선택: `PUBLIC_BASE_URL`, SMTP, Firebase — [`.env.example`](.env.example) 참고.  
운영 보안: [SECURITY.md](SECURITY.md).

## 사용

1. 관리자 콘솔에서 **Application**을 만듭니다 (client id/secret, 콜백 URL).
2. `PUBLIC_BASE_URL`을 공개 HTTPS 주소로 맞춥니다 (앱·OAuth 클라이언트가 사용).
3. 사용자는 Bio Pass를 설치하고 이메일로 로그인한 뒤 MFA 요청을 승인합니다.

```text
내 서비스  →  /api/web/authorize  →  Bio Pass (승인)  →  redirect_uri?code=…
```

스택: Node.js 22, Koa, PostgreSQL, React(Vite) 관리 콘솔.  
역할: `ADMIN` / `USER` (콘솔), `APP` (모바일). 단일 조직 셀프호스트.

## 개발

```bash
docker compose up -d db
cd backend && yarn install && yarn dev     # http://localhost:3030
cd frontend && pnpm install && pnpm dev    # http://localhost:3031 (/api 프록시)
```

## 라이선스

Apache-2.0 — [LICENSE](LICENSE), [NOTICE](NOTICE).  
[기여 안내](CONTRIBUTING.md) · [행동 강령](CODE_OF_CONDUCT.md) · [보안](SECURITY.md)
