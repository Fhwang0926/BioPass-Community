'use strict'

import { eq, asc, and } from 'drizzle-orm'
import config from '../../../config.js'
import { sql } from '../../../lib/index.js'
import { logSuccess, logFailure } from '../../../service/audit.js'

function trimTrailingSlash(value) {
  return String(value || '').replace(/\/+$/, '')
}

function resolveRequestOrigin(ctx) {
  return trimTrailingSlash(ctx.request.origin || `${ctx.request.protocol}://${ctx.request.host}`)
}

function normalizePublicBaseUrl() {
  const raw = trimTrailingSlash(process.env.PUBLIC_BASE_URL || '')
  if (!raw) return ''
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
    return trimTrailingSlash(url.origin)
  } catch {
    return ''
  }
}

function resolveConsoleOrigin(ctx) {
  return trimTrailingSlash(
    process.env.FRONTEND_ORIGIN ||
    process.env.PUBLIC_FRONTEND_ORIGIN ||
    normalizePublicBaseUrl() ||
    resolveRequestOrigin(ctx)
  )
}

export function register(route) {
  route.get('/check-site', async (ctx) => {
    try {
      const url = ctx.request.query.url || ctx.request.query.origin
      if (!url) {
        ctx.status = 400
        ctx.body = { error: 'invalid_request', error_description: 'url 또는 origin 쿼리 파라미터가 필요합니다.' }
        return
      }
      let origin
      try {
        origin = new URL(url).origin
      } catch {
        ctx.status = 400
        ctx.body = { error: 'invalid_request', error_description: '유효한 url 또는 origin을 입력해 주세요.' }
        return
      }

      const consoleOrigin = resolveConsoleOrigin(ctx)
      const company = await sql.db
        .select({
          id: sql.schema.sysCompany.id,
          name: sql.schema.sysCompany.name
        })
        .from(sql.schema.sysCompany)
        .where(and(
          eq(sql.schema.sysCompany.isDel, false),
          eq(sql.schema.sysCompany.isActive, true)
        ))
        .orderBy(asc(sql.schema.sysCompany.id))
        .limit(1)
        .get()

      ctx.body = await logSuccess(ctx, 'check_site', 'Site check completed', {
        result: true,
        supported: true,
        url: origin,
        console_url: consoleOrigin,
        app_name: company?.name || 'BioPass',
        server_version: config.version,
        auth_mode: 'self-host-console'
      })
    } catch (e) {
      ctx.body = await logFailure(ctx, 'check_site', 'Check site failed', e)
    }
  })
}
