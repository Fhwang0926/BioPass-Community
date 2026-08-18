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
  <strong>在自有基础设施上运行的生物识别 MFA</strong><br/>
  自行托管 OAuth API 和管理控制台。<br/>
  终端用户通过
  <a href="https://apps.apple.com/br/app/bio-pass/id6760216314">Bio Pass</a>
  使用指纹或 Face ID 批准登录。
</p>

<p align="center">
  <a href="https://github.com/Fhwang0926/BioPass-Community/releases/latest"><img alt="最新发行版" src="https://img.shields.io/github/v/release/Fhwang0926/BioPass-Community?label=release" /></a>
  <a href="https://github.com/Fhwang0926/BioPass-Community/pkgs/container/biopass-community"><img alt="GHCR" src="https://img.shields.io/badge/GHCR-biopass--community-2496ED?logo=docker&logoColor=white" /></a>
  <a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/license-Apache%202.0-blue.svg" /></a>
  <a href="https://apps.apple.com/br/app/bio-pass/id6760216314"><img alt="App Store" src="https://img.shields.io/badge/App%20Store-Bio%20Pass-0a7cff?logo=apple&logoColor=white" /></a>
</p>

## 这是什么

| 组成部分 | 作用 |
|----------|------|
| **本仓库** | 自托管 **服务器** — OAuth 授权/令牌、邮箱 OTP、管理界面、多应用管理 |
| **[Bio Pass](https://apps.apple.com/br/app/bio-pass/id6760216314)** | 配套 **移动应用**（App Store · iOS 15+）— 通过生物识别批准/拒绝登录请求 |

Google Play 尚未上架。

<p align="center">
  <a href="https://apps.apple.com/br/app/bio-pass/id6760216314">
    <img src="docs/assets/logo.png" width="72" alt="BioPass 标志" />
  </a>
</p>

<p align="center">
  <img src="docs/assets/flow-download.png" width="170" alt="1. 安装 Bio Pass" />
  <img src="docs/assets/flow-approve.png" width="170" alt="2. 使用生物识别批准" />
  <img src="docs/assets/flow-done.png" width="170" alt="3. 登录完成" />
</p>

1. 安装 Bio Pass，并注册到**你的服务器**（`PUBLIC_BASE_URL`）。应用会先探测该 origin 上的 `GET /api/app/check-site`，然后再注册。
2. 你的应用启动 OAuth → 推送 / 深链接 → 使用生物识别批准。
3. 浏览器带着 `redirect_uri?code=…` 返回你的应用。

配置 SMTP 后，即使没有移动应用也可以使用邮箱 OTP。

## 安装

需要 [Docker Compose](https://docs.docker.com/compose/) v2。

```bash
git clone https://github.com/Fhwang0926/BioPass-Community.git
cd BioPass-Community
cp .env.example .env
```

在 `.env` 中设置必填项：

- `AUTH_SECRET` — `openssl rand -hex 32`
- `POSTGRES_PASSWORD` — 足够强的数据库密码

### A) 从源码构建

```bash
docker compose up --build -d
```

### B) 从 GHCR 拉取

镜像：[`ghcr.io/fhwang0926/biopass-community`](https://github.com/Fhwang0926/BioPass-Community/pkgs/container/biopass-community)  
当前版本请查看 [Releases](https://github.com/Fhwang0926/BioPass-Community/releases/latest)（上方徽章）。

| 标签 | 发布时间 |
|------|----------|
| `latest`, `X.Y.Z`, `X.Y` | 仅在 git 标签 `vX.Y.Z` 时 |
| `dev`, `dev.YYYYMMDD` | 每次推送到 `dev` 分支（UTC 日期） |

仅推送到 `main` **不会**发布镜像。

```bash
# 稳定版（建议固定版本）
docker pull ghcr.io/fhwang0926/biopass-community:latest
docker pull ghcr.io/fhwang0926/biopass-community:0.1.0

IMAGE_TAG=0.1.0 docker compose -f docker-compose.ghcr.yml up -d

# 开发预览
docker pull ghcr.io/fhwang0926/biopass-community:dev
IMAGE_TAG=dev docker compose -f docker-compose.ghcr.yml up -d
```

打开 http://localhost:3030 → **`/#/setup`** → **`/#/login`**。

可选环境变量（`PUBLIC_BASE_URL`、SMTP、Firebase）：[`.env.example`](.env.example)。  
生产环境加固：[SECURITY.md](SECURITY.md)。

### 发布发行版镜像

```bash
git tag v0.2.0
git push origin v0.2.0
# → GHCR 标签: 0.2.0, 0.2, latest
```

## 使用

1. 在管理控制台中创建 **Application**（client id / secret、回调 URL）。
2. 将 `PUBLIC_BASE_URL` 设为公开的 HTTPS origin。
3. 用户安装 Bio Pass，使用邮箱登录，并批准 MFA 提示。

```text
你的应用  →  /api/web/authorize  →  Bio Pass（批准）  →  redirect_uri?code=…
```

技术栈：Node.js 22 · Koa · PostgreSQL · React（Vite）管理控制台。  
角色：`ADMIN` / `USER`（控制台），`APP`（移动端）。单组织自托管。

## 管理界面语言

管理控制台提供六种 locale（页头 / 公开页面中的语言切换器）：

| Locale | 语言 |
|--------|------|
| `en_US` | 英语（回退） |
| `ko_KR` | 韩语 |
| `ja_JP` | 日语 |
| `zh_CN` | 简体中文 |
| `es_ES` | 西班牙语 |
| `fr_FR` | 法语 |

偏好保存在 `localStorage`（`i18nextLng`）中。首次访问时，若浏览器语言匹配受支持的 locale，则使用该语言（例如 `ja` → `ja_JP`，`zh` / `zh-TW` → `zh_CN`）。文案目录位于 [`frontend/src/locales/lang/`](frontend/src/locales/lang/)；请用 `cd frontend && pnpm i18n:check` 保持键一致。

法律文档**正文**仅提供韩语或英语（非 `ko_KR` 时为英语）。开发者代码示例同样如此。

## 开发

```bash
docker compose up -d db
cd backend && yarn install && yarn dev     # http://localhost:3030
cd frontend && pnpm install && pnpm dev    # http://localhost:3031（代理 /api）
```

## 许可证

Apache-2.0 — [LICENSE](LICENSE)、[NOTICE](NOTICE)。  
[贡献指南](CONTRIBUTING.md) · [行为准则](CODE_OF_CONDUCT.md) · [安全](SECURITY.md)
