'use strict'

import { eq, and, desc, lt, inArray } from 'drizzle-orm'
import { sql } from '../../../lib/index.js'
import { logSuccess, logFailure } from '../../../service/audit.js'
import { AuthRequestStatus } from '../../../service/stateMachine.js'
import { transitionAuthRequest } from '../../../service/transition.js'

async function handleMyAuthRequests(ctx) {
  try {
    const profile = ctx.request.profile
    if (!profile?.id) {
      ctx.status = 401
      ctx.body = { error: 'unauthorized', error_description: 'JWT 토큰이 필요합니다.' }
      return
    }
    const userId = profile.id

    // Do not claim placeholder (user_id '0') requests via request_id — that was an IDOR
    // (any app JWT holder who obtained the id could bind and approve). Binding happens
    // only through email verification / authorize resolution of a known user.

    const now = Date.now()
    const expiredPending = await sql.db
      .select({ id: sql.schema.authRequests.id })
      .from(sql.schema.authRequests)
      .where(and(
        eq(sql.schema.authRequests.userId, String(userId)),
        eq(sql.schema.authRequests.status, AuthRequestStatus.PENDING),
        lt(sql.schema.authRequests.expiresAt, now)
      ))
      .all()
    await Promise.allSettled(
      expiredPending.map((r) =>
        transitionAuthRequest({ authRequestId: r.id, newStatus: AuthRequestStatus.EXPIRED, metadata: { reason: 'lazy_expire' } })
      )
    )

    // 해당 사용자의 인증 요청 전체 조회 (대기중만이 아닌 전체)
    const requests = await sql.db
      .select({
        id: sql.schema.authRequests.id,
        appId: sql.schema.authRequests.appId,
        status: sql.schema.authRequests.status,
        requestIp: sql.schema.authRequests.requestIp,
        userAgent: sql.schema.authRequests.userAgent,
        expiresAt: sql.schema.authRequests.expiresAt,
        approvedAt: sql.schema.authRequests.approvedAt,
        deniedAt: sql.schema.authRequests.deniedAt,
        createdAt: sql.schema.authRequests.createdAt
      })
      .from(sql.schema.authRequests)
      .where(eq(sql.schema.authRequests.userId, String(userId)))
      .orderBy(desc(sql.schema.authRequests.createdAt))
      .limit(100)
      .all()

    const appIds = [...new Set(requests.map(r => r.appId))]
    const appRows = appIds.length
      ? await sql.db
        .select({ id: sql.schema.apps.id, name: sql.schema.apps.name, clientId: sql.schema.apps.clientId })
        .from(sql.schema.apps)
        .where(inArray(sql.schema.apps.id, appIds))
        .all()
      : []
    const appMap = Object.fromEntries((appRows || []).map(a => [a.id, a]))

    const data = requests.map(r => ({
      request_id: r.id,
      app_id: r.appId,
      app_name: appMap[r.appId]?.name ?? null,
      client_id: appMap[r.appId]?.clientId ?? null,
      status: r.status,
      request_ip: r.requestIp,
      user_agent: r.userAgent,
      expires_at: r.expiresAt,
      approved_at: r.approvedAt ?? null,
      denied_at: r.deniedAt ?? null,
      created_at: r.createdAt
    }))

    ctx.body = await logSuccess(ctx, 'my_auth_requests', 'My auth requests retrieved', { result: true, data })
  } catch (e) {
    ctx.body = await logFailure(ctx, 'my_auth_requests', 'My auth requests failed', e)
  }
}

export function register(route) {
  route.get('/my-auth-requests', handleMyAuthRequests)
  route.post('/my-auth-requests', handleMyAuthRequests)
}
