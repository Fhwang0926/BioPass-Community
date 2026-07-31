'use strict'

import { eq, and } from 'drizzle-orm'
import { sql } from '../../../lib/index.js'
import { logSuccess, logFailure } from '../../../service/audit.js'

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

      const sysApp = await sql.db
        .select({
          id: sql.schema.sysApplication.id,
          name: sql.schema.sysApplication.name,
          clientId: sql.schema.sysApplication.clientId,
          callbackUrl: sql.schema.sysApplication.callbackUrl
        })
        .from(sql.schema.sysApplication)
        .where(and(
          eq(sql.schema.sysApplication.isDel, false),
          eq(sql.schema.sysApplication.isActive, true)
        ))
        .all()
      const matchedSys = (sysApp || []).find(
        app => app.callbackUrl && (app.callbackUrl === origin || app.callbackUrl.startsWith(origin + '/'))
      )

      const legacyApps = await sql.db
        .select({
          id: sql.schema.apps.id,
          name: sql.schema.apps.name,
          clientId: sql.schema.apps.clientId,
          redirectUri: sql.schema.apps.redirectUri
        })
        .from(sql.schema.apps)
        .all()
      const matchedLegacy = (legacyApps || []).find(
        app => app.redirectUri && (app.redirectUri === origin || app.redirectUri.startsWith(origin + '/'))
      )
      const matched = matchedSys || matchedLegacy

      // Only return a boolean — do not leak app_name / client_id to unauthenticated callers.
      ctx.body = await logSuccess(ctx, 'check_site', 'Site check completed', {
        result: true,
        supported: Boolean(matched),
        url: origin
      })
    } catch (e) {
      ctx.body = await logFailure(ctx, 'check_site', 'Check site failed', e)
    }
  })
}
