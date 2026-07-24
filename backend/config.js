import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
// Prefer repo-root `.env` (Compose / single sample), then `backend/.env` overrides.
dotenv.config({ path: path.resolve(repoRoot, '.env') })
dotenv.config({ path: path.resolve(__dirname, '.env'), override: true })

/** backend/json 하위 경로: 인증 정보 JSON(예: Firebase 서비스 계정 키)을 두는 디렉터리 */
const authJsonDir = path.resolve(__dirname, 'json')
/** Firebase 서비스 계정 JSON 기본 파일명 (env 미설정 시 사용) */
const DEFAULT_FIREBASE_SERVICE_ACCOUNT_JSON = 'firebase-service-account.json'

/**
 * JWT 서명/검증용 시크릿 해석.
 * - 반드시 AUTH_SECRET 환경변수로 주입한다 (소스에 하드코딩 금지).
 * - 프로덕션에서 미설정/취약값이면 즉시 기동 실패시켜 토큰 위조를 방지한다.
 * - 개발 환경에서만 임시 기본값을 허용한다.
 */
const INSECURE_DEFAULT_AUTH_SECRET = 'kiss,dry,yagni,undefined'
/** Known-weak placeholders that must never be used in production. */
const WEAK_AUTH_SECRETS = new Set([
  INSECURE_DEFAULT_AUTH_SECRET,
  'change-me-use-openssl-rand-hex-32',
  'changeme',
  'change-me',
  'secret',
  'password',
  'biopass'
])

function resolveAuthSecret() {
  const fromEnv = (process.env.AUTH_SECRET || '').trim()
  if (process.env.NODE_ENV === 'production') {
    if (!fromEnv || fromEnv.length < 32 || WEAK_AUTH_SECRETS.has(fromEnv)) {
      throw new Error(
        'AUTH_SECRET is missing or too weak for production. ' +
        'Set a random secret of at least 32 characters (e.g. openssl rand -hex 32).'
      )
    }
    return fromEnv
  }
  if (!fromEnv) {
    console.warn('[config] AUTH_SECRET 미설정 → 개발용 임시 시크릿 사용. 운영 배포 전 반드시 설정하세요.')
    return INSECURE_DEFAULT_AUTH_SECRET
  }
  if (WEAK_AUTH_SECRETS.has(fromEnv) || fromEnv.length < 16) {
    console.warn('[config] AUTH_SECRET looks weak — use openssl rand -hex 32 before any shared deploy.')
  }
  return fromEnv
}

/** Community Compose defaults (user/db/password = biopass). */
function resolveDatabaseConfig() {
  const url = (process.env.DATABASE_URL || '').trim() || null
  const host = process.env.DB_HOST || 'localhost'
  const user = process.env.DB_USER || 'biopass'
  const pass = process.env.DB_PASS || 'biopass'
  const name = process.env.DB_NAME || 'biopass'
  const port = Number(process.env.DB_PORT) || 5432
  return {
    description: 'PostgreSQL',
    dialect: 'postgresql',
    host,
    user,
    pass,
    sid: name,
    port,
    url: url || `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${host}:${port}/${name}`,
    name
  }
}

function resolveMailConfig() {
  return {
    description: 'SMTP',
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    service: process.env.SMTP_SERVICE || '',
    maxRetries: Number(process.env.SMTP_MAX_RETRIES) >= 0 ? Number(process.env.SMTP_MAX_RETRIES) : 2,
    retryDelayMs: Number(process.env.SMTP_RETRY_DELAY_MS) > 0 ? Number(process.env.SMTP_RETRY_DELAY_MS) : 500
  }
}

function resolveJsonConfig() {
  const filename = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || DEFAULT_FIREBASE_SERVICE_ACCOUNT_JSON
  return {
    dir: authJsonDir,
    firebaseServiceAccount: filename,
    firebaseServiceAccountPath: path.join(authJsonDir, filename)
  }
}

const shared = {
  version: '1.0.0',
  maintenance: process.env.MAINTENANCE_EMAIL || '',
  contactEmail: process.env.CONTACT_EMAIL || '',
  timezone: process.env.TZ_OFFSET || process.env.APP_TIMEZONE || '+00:00',
  auth: {
    use: true,
    ban: true,
    secret: resolveAuthSecret(),
    refresh: process.env.AUTH_REFRESH || '7d',
    access: process.env.AUTH_ACCESS || '6h',
    // App bearer tokens should be short-lived; refresh covers longer sessions.
    accessApp: process.env.AUTH_ACCESS_APP || '1d'
  },
  db: resolveDatabaseConfig(),
  mail: resolveMailConfig(),
  server: {
    ip: process.env.SERVER_IP || '127.0.0.1'
  },
  json: resolveJsonConfig(),
  init: false,
  init_time: ''
}

const port = Number(process.env.PORT) || 3030

const prod = {
  ...shared,
  name: 'admin',
  description: 'admin',
  web: {
    upload: './upload',
    host: '0.0.0.0',
    ssl: { use: false, key: '', cert: '' },
    port
  },
  debug: false
}

const dev = {
  ...shared,
  name: 'dev',
  description: 'dev',
  web: {
    upload: './upload',
    host: '0.0.0.0',
    ssl: { use: false, key: '', cert: '' },
    port
  },
  debug: true
}

const config = process.env.NODE_ENV === 'production' ? prod : dev

export default config
