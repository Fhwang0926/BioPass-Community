'use strict'

import fs from 'fs'
import http from 'http'
import https from 'https'
import os from 'os'
import cors from '@koa/cors'
import chalk from 'chalk'
import jwt from 'jsonwebtoken'
import Koa from 'koa'
import bodyParser from 'koa-bodyparser'
import nocache from 'koa-no-cache'
import Router from 'koa-router'
import send from 'koa-send'
import serve from 'koa-static-server'
import moment from 'moment-timezone'
import api from './api/index.js'
import config from './config.js'
import { sql, smtp } from './lib/index.js'
import { swagger } from './service/index.js'
import { rateLimitMiddleware } from './lib/rateLimit.js'

const app = new Koa()
let router = new Router()

const sanitizeLogFragment = (value, maxLen = 180) =>
  String(value ?? '')
    .replace(/[\r\n\t\0]/g, ' ')
    .slice(0, maxLen)

/** Redact sensitive OAuth / auth query values before logging. */
const sanitizeUrlForLog = (rawUrl) => {
  const value = String(rawUrl || '')
  try {
    const parsed = new URL(value, 'http://localhost')
    const sensitive = [
      'code', 'token', 'access_token', 'refresh_token', 'id_token',
      'client_secret', 'password', 'state', 'assertion'
    ]
    for (const key of sensitive) {
      if (parsed.searchParams.has(key)) parsed.searchParams.set(key, '[redacted]')
    }
    return `${parsed.pathname}${parsed.search}`
  } catch {
    return value.replace(
      /([?&](?:code|token|access_token|refresh_token|id_token|client_secret|password|state|assertion)=)[^&]*/gi,
      '$1[redacted]'
    )
  }
}

/**
 * Initialize and run the server
 */
const run = () => {
  // Trust X-Forwarded-* only when behind a reverse proxy (see TRUST_PROXY).
  app.proxy = process.env.TRUST_PROXY === '1' || process.env.TRUST_PROXY === 'true'

  const enableSwagger =
    process.env.ENABLE_SWAGGER === '1' ||
    process.env.ENABLE_SWAGGER === 'true' ||
    process.env.NODE_ENV !== 'production'
  if (enableSwagger) {
    const swaggerResult = swagger(app, router)
    router = swaggerResult[1]
  }

  // Error logging - 404는 간단히만 로그
  app.on('error', (err, ctx) => {
    if (err.status === 404) {
      // 404 오류는 간단히만 로그 (디버깅용)
      console.log(`[404] ${ctx.request.method} ${sanitizeLogFragment(sanitizeUrlForLog(ctx.request.url))}`)
    } else {
      // 다른 오류는 상세 로그
      console.error(err)
    }
  })

  // CORS: credentials only for known origins. Allowlist is auto-built from
  // PUBLIC_BASE_URL / FRONTEND_ORIGIN (+ local defaults) when CORS_ORIGINS is unset.
  const normalizeOrigin = (value) => String(value || '').trim().replace(/\/+$/, '')
  const parseOriginList = (raw) =>
    String(raw || '')
      .split(',')
      .map(normalizeOrigin)
      .filter(Boolean)

  const autoCorsOrigins = [
    ...parseOriginList(process.env.PUBLIC_BASE_URL),
    ...parseOriginList(process.env.FRONTEND_ORIGIN),
    ...parseOriginList(process.env.PUBLIC_FRONTEND_ORIGIN),
    'http://localhost:3030',
    'http://localhost:3031',
    'http://127.0.0.1:3030',
    'http://127.0.0.1:3031'
  ]
  const corsAllowlist = [
    ...new Set([
      ...parseOriginList(process.env.CORS_ORIGINS),
      ...(process.env.CORS_ORIGINS ? [] : autoCorsOrigins)
    ])
  ]
  const isDevEnv = process.env.NODE_ENV !== 'production'
  app.use(cors({
    origin: (ctx) => {
      const reqOrigin = normalizeOrigin(ctx.get('Origin'))
      if (!reqOrigin) return corsAllowlist[0] || false
      if (corsAllowlist.includes(reqOrigin)) return reqOrigin
      // Dev-only: reflect localhost origins for Vite HMR / alternate ports
      if (isDevEnv && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(reqOrigin)) {
        return reqOrigin
      }
      return false
    },
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization']
  }))

  // Body parser
  app.use(bodyParser({ jsonLimit: '2mb', formLimit: '2mb' }))

  // Request logger (path only — never log raw query strings with OAuth codes)
  app.use(async (ctx, next) => {
    const start = Date.now()
    await next()
    const ms = Date.now() - start
    console.log(`[${ctx.method}] ${ctx.path} ${ctx.status} ${ms}ms`)
  })

  // No-cache middleware
  app.use(nocache({ paths: ['/api'] }))

  // Middleware to extract client IP
  app.use(fromIpMiddleware)

  // Baseline rate limits for public auth / notify surfaces
  const clientKey = (ctx) => `${ctx.request.from_ip || ctx.ip || 'unknown'}`
  app.use(rateLimitMiddleware(
    (ctx) => (ctx.path === '/api/auth/signin' ? `signin:${clientKey(ctx)}` : ''),
    { limit: 20, windowMs: 15 * 60 * 1000, message: 'Too many login attempts. Try again later.' }
  ))
  app.use(rateLimitMiddleware(
    (ctx) => (ctx.path === '/api/auth/setup' ? `setup:${clientKey(ctx)}` : ''),
    { limit: 5, windowMs: 60 * 60 * 1000, message: 'Too many setup attempts. Try again later.' }
  ))
  app.use(rateLimitMiddleware(
    (ctx) => (ctx.path === '/api/web/notify-auth-request' ? `notify:${clientKey(ctx)}` : ''),
    { limit: 30, windowMs: 10 * 60 * 1000, message: 'Too many notification requests.' }
  ))
  app.use(rateLimitMiddleware(
    (ctx) => (
      ctx.path.includes('email-code') || ctx.path.includes('request-email') || ctx.path.startsWith('/api/app/signup')
        ? `emailcode:${clientKey(ctx)}`
        : ''
    ),
    { limit: 30, windowMs: 15 * 60 * 1000, message: 'Too many verification requests.' }
  ))

  // Token validation middleware
  app.use(tokenValidationMiddleware)

  // iso8601 to Date
  app.use(iso8601ToDate)

  // Define routes
  router.get('/hi', (ctx) => (ctx.body = 'Welcome to the web framework site'))
  router.get('/ping', (ctx) => (ctx.body = Date.now()))

  // Chrome DevTools: /.well-known/appspecific/com.chrome.devtools.json → 200 + empty JSON (404 방지)
  router.get('/.well-known/appspecific/com.chrome.devtools.json', (ctx) => {
    ctx.type = 'application/json'
    ctx.body = {}
  })

  // Serve index.html for root requests
  router.get('/', async (ctx) => {
    await send(ctx, 'index.html', { root: './wwwroot' })
  })

  // Add API routes
  // init api with version
  api.forEach(x => {
    const router = x.route.prefix(`/api${x.prefix}`)
    app.use(router.routes())
    if (router.stack && router.stack.length > 0) {
      const methods = router.stack.flatMap(layer => layer.methods).filter(Boolean)
      console.log('[+]', `/api${x.prefix}`, [...new Set(methods)].join(','))
    }
  })

  // Apply routes
  app.use(router.routes())

  // 정적 파일 (wwwroot/assets 등) — API 라우터 이후에 서빙
  app.use(serve({ rootDir: './wwwroot' }))

  // SPA fallback: admin UI client routes (non-API GETs without a file extension)
  app.use(async (ctx) => {
    if (ctx.method === 'GET' && !ctx.path.startsWith('/api') && !ctx.path.includes('.')) {
      await send(ctx, 'index.html', { root: './wwwroot' })
      return
    }
    if (ctx.status === 404 || !ctx.body) {
      console.log(`[404] ${ctx.request.method} ${sanitizeLogFragment(sanitizeUrlForLog(ctx.request.url))}`)
      return notFoundHandler(ctx)
    }
  })

  // Start the server
  startServer(app)
}

/**
 * Middleware to extract client IP
 */
const fromIpMiddleware = async (ctx, next) => {
  const getIp = (req) => {
    return (
      req.connection?.remoteAddress ||
      req.socket?.remoteAddress ||
      req.info?.remoteAddress ||
      '0.0.0.0'
    ).replace(/::ffff:/, '')
  }

  ctx.request.from_ip = getIp(ctx.request)
  ctx.request.start_time = Date.now()
  const trustProxy = process.env.TRUST_PROXY === '1' || process.env.TRUST_PROXY === 'true'
  if (trustProxy && ctx.request.header['x-forwarded-for']) {
    ctx.request.from_ip = ctx.request.header['x-forwarded-for'].split(',')[0].trim()
  }

  await next()
}

/**
 * Middleware for token validation
 */
const tokenValidationMiddleware = async (ctx, next) => {
  try {
    // API가 아닌 경로는 통과
    if (!ctx.request.url.startsWith('/api')) {
      return next()
    }

    // 인증이 필요 없는 auth API 경로들. /api/auth/dashboard는 서비스 데이터라 토큰 검증이 필요하다.
    const publicAuthPath = [
      /^\/api\/auth\/refresh\/[^/]+$/,
      /^\/api\/auth\/signin$/,
      /^\/api\/auth\/setup$/,
      /^\/api\/auth\/setup\/status$/,
      /^\/api\/auth\/logout$/
    ].some((pattern) => pattern.test(ctx.path))
    if (publicAuthPath) {
      return next()
    }

    // app 에서 호출하는 API 경로들 (선택적 JWT: 있으면 profile 설정, 없으면 통과)
    if (ctx.request.url.startsWith('/api/app')) {
      const authHeader = ctx.request.header['authorization']
      if (authHeader) {
        try {
          const token = authHeader.replace(/Bearer /gi, '')
          const decoded = jwt.verify(token, config.auth.secret)
          ctx.request.profile = decoded.profile || (decoded.id != null ? { id: decoded.id } : undefined)
        } catch (err) {
          // 토큰 없음/만료 시 profile만 비움, 401은 각 라우트에서 처리
        }
      }
      return next()
    }

    // web 에서 호출하는 API 경로들
    if (ctx.request.url.startsWith('/api/web')) {
      return next()
    }

    const authHeader = ctx.request.header['authorization']
    const requestPath = `${ctx.request.method} ${sanitizeUrlForLog(ctx.request.url)}`

    if (!authHeader) {
      console.warn(`[AUTH] Authorization token is missing (${sanitizeLogFragment(requestPath)})`)
      ctx.throw(401, 'Unauthorized')
    }

    const token = authHeader.replace(/Bearer /gi, '')
    const profile = jwt.verify(token, config.auth.secret).profile

    ctx.request.profile = profile
    return next()
  } catch (err) {
    const requestPath = `${ctx.request.method} ${sanitizeUrlForLog(ctx.request.url)}`
    // Do not log the full Error object — it can retain Authorization / token context.
    console.error(
      `[AUTH] ${sanitizeLogFragment(err.name || 'Error')}: ${sanitizeLogFragment(err.message || 'Unauthorized')} (${sanitizeLogFragment(requestPath)})`
    )
    ctx.throw(401, { error: { code: err.statusCode || 401, message: 'Unauthorized' } })
  }
}

/**
 * 미들웨어로 z -> 자동변환
 * todo: db저장 시간 created_at, updated_at 과 다르게 저장되고있어 수정예정
 */
const iso8601ToDate = async (ctx, next) => {
  try {
    if (
      !ctx.request.url.startsWith('/api') ||
      ctx.request.url.startsWith('/api/auth')
    ) {
      return next()
    }
    const body = ctx.request.body
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return next()
    }
    const iso8601 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/
    // Rebuild with an allowlisted key pattern to avoid remote property injection (__proto__, etc.).
    const nextBody = Object.create(null)
    for (const key of Object.keys(body)) {
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue
      const value = body[key]
      if (typeof value === 'string' && iso8601.test(value)) {
        nextBody[key] = moment(value).utc().format('YYYY-MM-DD HH:mm:ss')
      } else {
        nextBody[key] = value
      }
    }
    ctx.request.body = nextBody
    return next()
  } catch (err) {
    ctx.throw(400, { error: { code: 400, message: err.message || 'Invalid request body' } })
  }
}

/**
 * Handle 404 errors
 */
const notFoundHandler = async (ctx) => {
  ctx.throw(404, 'Resource not found')
}

/**
 * Start the server
 */
const startServer = (app) => {
  const protocol = config.web.ssl.use ? 'https' : 'http'
  const port = process.env.PORT || config.web.port
  const onListen = () => {
    console.log(chalk.yellow(`Listening on ${protocol}://${config.web.host}:${port}...`))
  }

  if (config.web.ssl.use) {
    const options = {
      key: fs.readFileSync(config.web.ssl.key),
      cert: fs.readFileSync(config.web.ssl.cert)
    }
    https.createServer(options, app.callback()).listen(port, config.web.host, onListen)
  } else {
    http.createServer(app.callback()).listen(port, config.web.host, onListen)
  }
}

// Run the server
(async () => {
  if (config.timezone) {
    process.env.TZ = config.timezone
  }

  console.log(new Date().toLocaleString(), config.timezone, new Date())
  console.log('----------------------------------------------------------------')
  console.log(`BioPass Community on ${os.hostname()}`)
  console.log(`OS : ${os.type()} ${os.release()} ${process.platform}`)
  console.log(`CPU : ${os.cpus()[0].model.trim()} ${os.cpus().length} core ${os.arch()} ${os.cpus()[0].speed} Mhz`)
  console.log(`Memory : ${parseInt(os.freemem() / 1073741824)} GB / ${parseInt(os.totalmem() / 1073741824)} GB`)
  console.log(`Node : ${process.versions.node}`)
  console.log(`Environment: ${process.env.NODE_ENV || ''}`)
  console.log(`DB Host: ${config.db.host || ''}`)
  console.log('----------------------------------------------------------------')

  // DB 연결 → Drizzle 스키마 sync (db:push) → 선택적 관리자 시드
  try {
    console.log(`Database: PostgreSQL (${sql.dbPath?.replace(/:[^:@]+@/, ':****@') || 'Unknown'})`)
    console.log('Initializing database schema and default user...')
    await sql.open()
    const { ensureTablesAndDefaultUser } = await import('./util/init/init_postgres.js')
    await ensureTablesAndDefaultUser()
  } catch (error) {
    console.error('Database initialization error:', error.message)
    console.error('='.repeat(60))
    console.error('Manual recovery (from backend/): npm run db:push')
    console.error('='.repeat(60))
    process.exit(1)
  }

  // SMTP 초기화 (이메일 발송용; SMTP_USER/SMTP_PASS 미설정 시 스킵)
  try {
    await smtp.init()
  } catch (err) {
    console.warn('SMTP init skipped or failed:', err?.message || err)
  }

  console.log('Starting server...')

  run()
})()

export default { run }
