import type { IntegrationVars } from "./IntegrationContext";

export type SampleLocale = "ko" | "en";

/** i18n locale → BioPass auth lang (ko | en) — default aligns with app fallback en_US */
export function resolveSampleLocale(i18nLanguage?: string): SampleLocale {
	const lang = String(i18nLanguage || "en").toLowerCase();
	if (lang.startsWith("ko")) return "ko";
	return "en";
}

export function frontendLoginSample(v: IntegrationVars, locale: SampleLocale = "ko"): string {
	if (locale === "en") {
		return `// Frontend — redirect to YOUR backend only (never expose client_secret)
function loginWithBioPass() {
  window.location.href = '${v.backendLoginUrl}';
}

// When email is known (e.g. after login form submit)
function loginWithBioPassEmail(email) {
  const params = new URLSearchParams({
    email: email.trim(),
    lang: 'en',
  });
  window.location.href = '${v.backendLoginUrl}?' + params.toString();
}`;
	}

	return `// 프론트엔드 — 자체 백엔드로만 이동 (client_id·client_secret 노출 금지)
function loginWithBioPass() {
  window.location.href = '${v.backendLoginUrl}';
}

// 이메일을 미리 알고 있는 경우 (예: 로그인 폼 제출 후)
function loginWithBioPassEmail(email) {
  const params = new URLSearchParams({
    email: email.trim(),
    lang: 'ko',
  });
  window.location.href = '${v.backendLoginUrl}?' + params.toString();
}`;
}

export function callbackPageSample(v: IntegrationVars, locale: SampleLocale = "ko"): string {
	if (locale === "en") {
		return `// Frontend home — after backend callback sets an httpOnly session cookie
// BioPass redirects to ${v.redirectUri} (your backend), not the browser directly.

async function loadSession() {
  const res = await fetch('/api/auth/me', { credentials: 'include' });
  if (!res.ok) {
    showLoginButton();
    return;
  }
  const { data } = await res.json();
  showLoggedInUser(data.user);
}`;
	}

	return `// 프론트 홈 — 백엔드 콜백에서 httpOnly 세션 쿠키 설정 후
// BioPass는 ${v.redirectUri}(백엔드)로 리다이렉트하며, code는 브라우저에 노출되지 않습니다.

async function loadSession() {
  const res = await fetch('/api/auth/me', { credentials: 'include' });
  if (!res.ok) {
    showLoginButton();
    return;
  }
  const { data } = await res.json();
  showLoggedInUser(data.user);
}`;
}

export function backendCallbackSample(v: IntegrationVars, locale: SampleLocale = "ko"): string {
	const callbackPath = v.redirectUri.replace(/^https?:\/\/[^/]+/, "") || "/api/auth/callback";

	if (locale === "en") {
		return `// Node.js (Express) — login start + BioPass callback + token exchange (server only)
const express = require('express');
const axios = require('axios');
const crypto = require('crypto');

const app = express();

const BIO_PASS_API = process.env.BIO_PASS_API || '${v.apiBase}';
const CLIENT_ID = process.env.BIO_PASS_CLIENT_ID || '${v.clientId}';
const CLIENT_SECRET = process.env.BIO_PASS_CLIENT_SECRET; // env only — never send to browser
const REDIRECT_URI = process.env.BIO_PASS_REDIRECT_URI || '${v.redirectUri}'; // register in BioPass app
const SCOPE = process.env.BIO_PASS_SCOPE || '${v.scope}';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://your-site.com';

// 1) Frontend login button hits this endpoint
app.get('/api/auth/login', (req, res) => {
  const state = crypto.randomUUID();
  req.session.oauthState = state;

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPE,
    state,
    lang: req.query.lang === 'en' ? 'en' : 'ko',
  });
  if (req.query.email) params.set('email', String(req.query.email).trim());

  res.redirect(\`\${BIO_PASS_API}/web/authorize?\${params.toString()}\`);
});

// 2) BioPass redirects here with ?code=...&state=...
app.get('${callbackPath}', async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code || req.session.oauthState !== state) {
      return res.status(400).send('Invalid OAuth state');
    }
    delete req.session.oauthState;

    const { data: tokens } = await axios.post(\`\${BIO_PASS_API}/web/token\`, {
      grant_type: 'authorization_code',
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
    });

    const { data: profile } = await axios.post(\`\${BIO_PASS_API}/web/verify-token\`, {
      token: tokens.access_token,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    });

    req.session.user = profile.user;
    res.redirect(req.query.return_to || FRONTEND_URL);
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.redirect(FRONTEND_URL + '?login=failed');
  }
});

app.get('/api/auth/me', (req, res) => {
  if (!req.session.user) return res.status(401).json({ result: false });
  res.json({ result: true, data: { user: req.session.user } });
});`;
	}

	return `// Node.js (Express) — 로그인 시작 + BioPass 콜백 + 토큰 교환 (서버 전용)
const express = require('express');
const axios = require('axios');
const crypto = require('crypto');

const app = express();

const BIO_PASS_API = process.env.BIO_PASS_API || '${v.apiBase}';
const CLIENT_ID = process.env.BIO_PASS_CLIENT_ID || '${v.clientId}';
const CLIENT_SECRET = process.env.BIO_PASS_CLIENT_SECRET; // 환경변수 전용 — 브라우저 노출 금지
const REDIRECT_URI = process.env.BIO_PASS_REDIRECT_URI || '${v.redirectUri}'; // BioPass 앱 Callback URL
const SCOPE = process.env.BIO_PASS_SCOPE || '${v.scope}';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://your-site.com';

// 1) 프론트 로그인 버튼 → 이 엔드포인트
app.get('/api/auth/login', (req, res) => {
  const state = crypto.randomUUID();
  req.session.oauthState = state;

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPE,
    state,
    lang: req.query.lang === 'en' ? 'en' : 'ko',
  });
  if (req.query.email) params.set('email', String(req.query.email).trim());

  res.redirect(\`\${BIO_PASS_API}/web/authorize?\${params.toString()}\`);
});

// 2) BioPass → ?code=...&state=... 로 리다이렉트
app.get('${callbackPath}', async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code || req.session.oauthState !== state) {
      return res.status(400).send('Invalid OAuth state');
    }
    delete req.session.oauthState;

    const { data: tokens } = await axios.post(\`\${BIO_PASS_API}/web/token\`, {
      grant_type: 'authorization_code',
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
    });

    const { data: profile } = await axios.post(\`\${BIO_PASS_API}/web/verify-token\`, {
      token: tokens.access_token,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    });

    req.session.user = profile.user;
    res.redirect(req.query.return_to || FRONTEND_URL);
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.redirect(FRONTEND_URL + '?login=failed');
  }
});

app.get('/api/auth/me', (req, res) => {
  if (!req.session.user) return res.status(401).json({ result: false });
  res.json({ result: true, data: { user: req.session.user } });
});`;
}

export function curlAuthorizeSample(v: IntegrationVars, locale: SampleLocale = "ko"): string {
	if (locale === "en") {
		return `# 1. Open YOUR backend login URL in browser (not BioPass directly)
open '${v.backendLoginUrl}?email=user@example.com&lang=en'

# 2. After BioPass redirects to ${v.redirectUri}, exchange code on server only
curl -X POST '${v.apiBase}/web/token' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "grant_type": "authorization_code",
    "code": "auth_XXXXXXXX",
    "client_id": "${v.clientId}",
    "client_secret": "YOUR_CLIENT_SECRET",
    "redirect_uri": "${v.redirectUri}"
  }'`;
	}

	return `# 1. 브라우저에서 자체 백엔드 로그인 URL 열기 (BioPass 직접 호출 X)
open '${v.backendLoginUrl}?email=user@example.com&lang=ko'

# 2. BioPass가 ${v.redirectUri} 로 리다이렉트한 뒤, 서버에서만 code 교환
curl -X POST '${v.apiBase}/web/token' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "grant_type": "authorization_code",
    "code": "auth_XXXXXXXX",
    "client_id": "${v.clientId}",
    "client_secret": "YOUR_CLIENT_SECRET",
    "redirect_uri": "${v.redirectUri}"
  }'`;
}

export function verifyTokenSample(v: IntegrationVars, locale: SampleLocale = "ko"): string {
	if (locale === "en") {
		return `POST ${v.apiBase}/web/verify-token
Content-Type: application/json

{
  "token": "<access_token>",
  "client_id": "${v.clientId}",
  "client_secret": "YOUR_CLIENT_SECRET"
}

// Example response
{
  "success": true,
  "authenticated": true,
  "user": {
    "id": "...",
    "email": "user@example.com",
    "name": "User Name",
    "nickname": "User Name",
    "phone": null,
    "status": "ACTIVE"
  }
}`;
	}

	return `POST ${v.apiBase}/web/verify-token
Content-Type: application/json

{
  "token": "<access_token>",
  "client_id": "${v.clientId}",
  "client_secret": "YOUR_CLIENT_SECRET"
}

// 응답 예시
{
  "success": true,
  "authenticated": true,
  "user": {
    "id": "...",
    "email": "user@example.com",
    "name": "사용자닉네임",
    "nickname": "사용자닉네임",
    "phone": null,
    "status": "ACTIVE"
  }
}`;
}

export function apiReferenceSample(locale: SampleLocale = "ko"): string {
	if (locale === "en") {
		return `Recommended integration
  Browser → GET your-backend/api/auth/login
  Your backend → GET /api/web/authorize (client_id, redirect_uri=backend callback)
  BioPass → GET your-backend/api/auth/callback?code=...
  Your backend → POST /api/web/token (client_secret server-side only)
  Your backend → redirect to frontend with session cookie

GET /api/web/authorize
  Query: client_id, redirect_uri, response_type=code, scope?, state?, email?, phone?, lang?
  → redirect_uri must exactly match the app Callback URL (your backend endpoint)
  → call from server only in production

POST /api/web/token
  Body: {
    "grant_type": "authorization_code",
    "code": "auth_...",
    "client_id": "...",
    "client_secret": "...",
    "redirect_uri": "..."
  }
  → { access_token, token_type, expires_in, refresh_token, scope }

POST /api/web/verify-token
  Body: { token, client_id, client_secret }
  → { success, authenticated, user: { id, email, name, nickname, phone, status } }

POST /api/web/auth-request-status
  Body: request_id, redirect_uri, state?, lang?
  → { status, redirect_url? } — browser polls until mobile approval completes`;
	}

	return `권장 연동 구조
  브라우저 → GET 자체-백엔드/api/auth/login
  자체 백엔드 → GET /api/web/authorize (client_id, redirect_uri=백엔드 콜백)
  BioPass → GET 자체-백엔드/api/auth/callback?code=...
  자체 백엔드 → POST /api/web/token (client_secret은 서버에서만)
  자체 백엔드 → 프론트로 세션 쿠키와 함께 리다이렉트

GET /api/web/authorize
  Query: client_id, redirect_uri, response_type=code, scope?, state?, email?, phone?, lang?
  → redirect_uri는 앱 Callback URL(백엔드 엔드포인트)과 정확히 일치
  → 운영 환경에서는 서버에서만 호출

POST /api/web/token
  Body: {
    "grant_type": "authorization_code",
    "code": "auth_...",
    "client_id": "...",
    "client_secret": "...",
    "redirect_uri": "..."
  }
  → { access_token, token_type, expires_in, refresh_token, scope }

POST /api/web/verify-token
  Body: { token, client_id, client_secret }
  → { success, authenticated, user: { id, email, name, nickname, phone, status } }

POST /api/web/auth-request-status
  Body: request_id, redirect_uri, state?, lang?
  → { status, redirect_url? } — 모바일 승인 완료를 브라우저가 폴링`;
}

export function errorCodesSample(locale: SampleLocale = "ko"): string {
	if (locale === "en") {
		return `{
  "invalid_request": "Missing or invalid required parameters",
  "invalid_client": "client_id or client_secret mismatch",
  "invalid_grant": "Code expired, reused, or mismatched",
  "invalid_redirect_uri": "redirect_uri does not match the app Callback URL",
  "unsupported_response_type": "Only response_type=code is supported",
  "access_denied": "User denied authentication",
  "server_error": "Internal server error"
}`;
	}

	return `{
  "invalid_request": "필수 파라미터 누락 또는 형식 오류",
  "invalid_client": "client_id 또는 client_secret 불일치",
  "invalid_grant": "code 만료·재사용·불일치",
  "invalid_redirect_uri": "redirect_uri가 앱 Callback URL과 불일치",
  "unsupported_response_type": "response_type은 code만 지원",
  "access_denied": "사용자가 인증을 거절함",
  "server_error": "서버 내부 오류"
}`;
}
