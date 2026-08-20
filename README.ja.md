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
  <strong>自社インフラで運用する生体認証 MFA</strong><br/>
  OAuth API と管理コンソールを自分のサーバーで実行します。<br/>
  エンドユーザーは
  <a href="https://apps.apple.com/br/app/bio-pass/id6760216314">Bio Pass</a>
  で指紋または Face ID によりサインインを承認します。
</p>

<p align="center">
  <a href="https://github.com/Fhwang0926/BioPass-Community/releases/latest"><img alt="最新リリース" src="https://img.shields.io/github/v/release/Fhwang0926/BioPass-Community?label=release" /></a>
  <a href="https://github.com/Fhwang0926/BioPass-Community/pkgs/container/biopass-community"><img alt="GHCR" src="https://img.shields.io/badge/GHCR-biopass--community-2496ED?logo=docker&logoColor=white" /></a>
  <a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/license-Apache%202.0-blue.svg" /></a>
  <a href="https://apps.apple.com/br/app/bio-pass/id6760216314"><img alt="App Store" src="https://img.shields.io/badge/App%20Store-Bio%20Pass-0a7cff?logo=apple&logoColor=white" /></a>
</p>

## これは何か

| 構成 | 役割 |
|------|------|
| **このリポジトリ** | セルフホスト **サーバー** — OAuth 認可/トークン、メール OTP、管理 UI、複数アプリ管理 |
| **[Bio Pass](https://apps.apple.com/br/app/bio-pass/id6760216314)** | 連携 **モバイルアプリ**（App Store · iOS 15+）— 生体認証でログインリクエストを承認/拒否 |

Google Play はまだ公開されていません。

<p align="center">
  <a href="https://apps.apple.com/br/app/bio-pass/id6760216314">
    <img src="docs/assets/logo.png" width="72" alt="BioPass ロゴ" />
  </a>
</p>

<p align="center">
  <img src="docs/assets/flow-download.png" width="170" alt="1. Bio Pass をインストール" />
  <img src="docs/assets/flow-approve.png" width="170" alt="2. 生体認証で承認" />
  <img src="docs/assets/flow-done.png" width="170" alt="3. ログイン完了" />
</p>

1. Bio Pass をインストールし、**自分のサーバー**（`PUBLIC_BASE_URL`）に登録します。アプリはその origin の `GET /api/app/check-site` を確認してからサインアップします。
2. アプリが OAuth を開始 → プッシュ / ディープリンク → 生体認証で承認します。
3. ブラウザーが `redirect_uri?code=…` でアプリに戻ります。

SMTP を設定すれば、モバイルアプリなしでもメール OTP を利用できます。

## インストール

[Docker Compose](https://docs.docker.com/compose/) v2 が必要です。

```bash
git clone https://github.com/Fhwang0926/BioPass-Community.git
cd BioPass-Community
cp .env.example .env
```

`.env` に必須の値を設定します。

- `AUTH_SECRET` — `openssl rand -hex 32`
- `POSTGRES_PASSWORD` — 十分な強度のデータベースパスワード

### A) ソースからビルド

```bash
docker compose up --build -d
```

### B) GHCR から pull

イメージ: [`ghcr.io/fhwang0926/biopass-community`](https://github.com/Fhwang0926/BioPass-Community/pkgs/container/biopass-community)  
現在のバージョンは [Releases](https://github.com/Fhwang0926/BioPass-Community/releases/latest)（上部のバッジ）で確認してください。

| タグ | 公開されるタイミング |
|------|----------------------|
| `latest`, `X.Y.Z`, `X.Y` | git タグ `vX.Y.Z` のときだけ |
| `dev`, `dev.YYYYMMDD` | `dev` ブランチへのプッシュごと（UTC 日付） |

`main` へのプッシュだけではイメージは公開**されません**。

```bash
# 安定版（バージョン固定を推奨）
docker pull ghcr.io/fhwang0926/biopass-community:latest
docker pull ghcr.io/fhwang0926/biopass-community:0.1.0

IMAGE_TAG=0.1.0 docker compose -f docker-compose.ghcr.yml up -d

# 開発用プレビュー
docker pull ghcr.io/fhwang0926/biopass-community:dev
IMAGE_TAG=dev docker compose -f docker-compose.ghcr.yml up -d
```

http://localhost:3030 → **`/#/setup`** → **`/#/login`**.

任意の env（`PUBLIC_BASE_URL`、SMTP、Firebase）: [`.env.example`](.env.example)。  
本番のセキュリティ強化: [SECURITY.md](SECURITY.md)。

### リリースイメージの公開

```bash
git tag v0.2.0
git push origin v0.2.0
# → GHCR タグ: 0.2.0, 0.2, latest
```

## 使い方

1. 管理コンソールで **Application** を作成します（client id / secret、コールバック URL）。
2. `PUBLIC_BASE_URL` を公開 HTTPS origin に設定します。
3. ユーザーは Bio Pass をインストールし、メールでサインインして MFA 要求を承認します。

```text
あなたのアプリ  →  /api/web/authorize  →  Bio Pass（承認）  →  redirect_uri?code=…
```

スタック: Node.js 22 · Koa · PostgreSQL · React（Vite）管理コンソール。  
ロール: `ADMIN` / `USER`（コンソール）、`APP`（モバイル）。単一組織のセルフホスト。

## 管理 UI の言語

管理コンソールは 6 つの locale に対応しています（ヘッダー / 公開ページの切り替え）:

| Locale | 言語 |
|--------|------|
| `en_US` | 英語（フォールバック） |
| `ko_KR` | 韓国語 |
| `ja_JP` | 日本語 |
| `zh_CN` | 中国語（簡体字） |
| `es_ES` | スペイン語 |
| `fr_FR` | フランス語 |

選択は `localStorage`（`i18nextLng`）に保存されます。初回訪問時は、ブラウザー言語が対応 locale と一致すればそれを使います（例: `ja` → `ja_JP`、`zh` / `zh-TW` → `zh_CN`）。カタログは [`frontend/src/locales/lang/`](frontend/src/locales/lang/) にあり、キーの一致は `cd frontend && pnpm i18n:check` で確認します。

法律文書の**本文**は韓国語または英語のみです（`ko_KR` 以外は英語）。開発者向けコードサンプルも同じです。

## 開発

```bash
docker compose up -d db
cd backend && yarn install && yarn dev     # http://localhost:3030
cd frontend && pnpm install && pnpm dev    # http://localhost:3031（/api をプロキシ）
```

## ライセンス

Apache-2.0 — [LICENSE](LICENSE)、[NOTICE](NOTICE)。  
[コントリビューション](CONTRIBUTING.md) · [行動規範](CODE_OF_CONDUCT.md) · [セキュリティ](SECURITY.md)
