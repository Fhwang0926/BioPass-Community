'use strict'

import { eq, and, inArray, gte, lte } from 'drizzle-orm'
import { sql } from '../../../lib/index.js'
import { logSuccess, logFailure } from '../../../service/audit.js'

/**
 * 통계 기본 기간 (일)
 * 클라이언트가 start_date/end_date를 지정하지 않으면 최근 N일치를 반환
 */
const DEFAULT_PERIOD_DAYS = 7

/**
 * 쿼리 파라미터에서 통계 조회 기간(밀리초 epoch)을 결정
 * 기본값: 오늘 포함 최근 7일 (6일 전 00:00 ~ 오늘 23:59:59.999)
 * @param {object} query Koa ctx.request.query
 * @returns {{startMs:number,endMs:number}}
 */
const resolvePeriod = (query) => {
  const now = Date.now()
  const endMs = query.end_date
    ? new Date(query.end_date).getTime() + 86400000 - 1
    : now
  const startMs = query.start_date
    ? new Date(query.start_date).getTime()
    : endMs - (DEFAULT_PERIOD_DAYS - 1) * 86400000 - (endMs % 86400000)
  return { startMs, endMs }
}

/**
 * 사용자 인증 요청 상태별 카운트 조회
 * @param {string} userId 앱 사용자 id (usr_*)
 * @param {{startMs:number,endMs:number}} period 조회 기간 (epoch ms)
 * @returns {Promise<Array>} status, count 배열
 */
const fetchStatusCounts = async (userId, period) => {
  const conditions = [
    eq(sql.schema.authRequests.userId, String(userId)),
    gte(sql.schema.authRequests.createdAt, period.startMs),
    lte(sql.schema.authRequests.createdAt, period.endMs)
  ]
  return sql.db
    .select({
      status: sql.schema.authRequests.status,
      count: sql.sql`count(*)`
    })
    .from(sql.schema.authRequests)
    .where(and(...conditions))
    .groupBy(sql.schema.authRequests.status)
    .all()
}

/**
 * status 그룹 카운트 결과를 통계 객체로 변환
 * APPROVED/CONSUMED → 승인, PENDING/CREATED → 대기로 합산
 * @param {Array} statusCounts fetchStatusCounts 결과
 * @returns {{total:number,approved:number,denied:number,expired:number,pending:number}}
 */
const aggregateStatusCounts = (statusCounts) => {
  const counts = {
    total: 0,
    approved: 0,
    denied: 0,
    expired: 0,
    pending: 0
  }
  const bucketMap = {
    APPROVED: 'approved',
    CONSUMED: 'approved',
    DENIED: 'denied',
    EXPIRED: 'expired',
    PENDING: 'pending',
    CREATED: 'pending'
  }
  for (const row of statusCounts) {
    const c = Number(row.count ?? 0)
    counts.total += c
    const bucket = bucketMap[row.status]
    if (bucket) counts[bucket] += c
  }
  return counts
}

/**
 * 사용자가 인증 요청을 받은 적 있는 등록된 앱(서비스) 목록 조회
 * app_auth_requests → app_sys_apps → sys_application 조인
 * @param {string} userId 앱 사용자 id (usr_*)
 * @returns {Promise<Array>} sys_application 행 목록
 */
const fetchUserRegisteredApps = async (userId) => {
  // 사용자가 인증 요청을 받은 app_id 목록 (애플리케이션 레이어에서 DISTINCT 처리)
  const appIdRows = await sql.db
    .select({ appId: sql.schema.authRequests.appId })
    .from(sql.schema.authRequests)
    .where(eq(sql.schema.authRequests.userId, String(userId)))
    .all()

  const appIds = [...new Set(appIdRows.map((r) => r.appId).filter(Boolean))]
  if (appIds.length === 0) return []

  // app_sys_apps에서 client_id 조회
  const appRows = await sql.db
    .select()
    .from(sql.schema.apps)
    .where(inArray(sql.schema.apps.id, appIds))
    .all()

  const clientIds = appRows.map((a) => a.clientId).filter(Boolean)
  if (clientIds.length === 0) return []

  // sys_application 조회
  const sysApps = await sql.db
    .select()
    .from(sql.schema.sysApplication)
    .where(and(
      eq(sql.schema.sysApplication.isDel, false),
      inArray(sql.schema.sysApplication.clientId, clientIds)
    ))
    .all()

  return sysApps
}

/**
 * sys_application 목록을 응답 페이로드 형태로 직렬화
 * @param {Array} sysApps sys_application 행 목록
 * @returns {Array} 직렬화된 객체 목록
 */
const serializeSysApps = (sysApps) => sysApps.map((a) => ({
  id: a.id,
  name: a.name,
  client_id: a.clientId,
  callback_url: a.callbackUrl,
  is_active: a.isActive,
  login_identifier: a.loginIdentifier,
  last_auth_request_at: a.lastAuthRequestAt,
  created_at: a.createdAt
}))

/**
 * 앱 사용자 통계 조회 라우트 등록
 * GET /stats/summary
 * - JWT 필수: 본인 (profile.id) 데이터만 집계
 * - Query (선택): start_date, end_date (YYYY-MM-DD).
 *   둘 다 없으면 기본 최근 7일치 (오늘 포함)
 * - 응답: total_requests, approved_count, denied_count, expired_count,
 *         pending_count, success_rate, period_start, period_end,
 *         registered_apps_count, registered_apps[]
 */
export function register(route) {
  route.get('/stats/summary', async (ctx) => {
    try {
      const profile = ctx.request.profile
      if (!profile?.id) {
        ctx.status = 401
        ctx.body = { error: 'unauthorized', error_description: 'JWT 토큰이 필요합니다.' }
        return
      }

      const query = ctx.request.query || {}
      const userId = profile.id
      const period = resolvePeriod(query)

      const statusCounts = await fetchStatusCounts(userId, period)
      const counts = aggregateStatusCounts(statusCounts)

      // 성공율 = 승인 / (승인 + 거절) * 100. 결정되지 않은 요청은 분모에서 제외.
      const decided = counts.approved + counts.denied
      const successRate = decided > 0
        ? Math.round((counts.approved / decided) * 10000) / 100
        : 0

      const sysApps = await fetchUserRegisteredApps(userId)

      ctx.body = await logSuccess(ctx, 'app_stats_summary', 'App stats retrieved', {
        total_requests: counts.total,
        approved_count: counts.approved,
        denied_count: counts.denied,
        expired_count: counts.expired,
        pending_count: counts.pending,
        success_rate: successRate,
        period_start: period.startMs,
        period_end: period.endMs,
        registered_apps_count: sysApps.length,
        registered_apps: serializeSysApps(sysApps)
      })
    } catch (e) {
      console.error('[app_stats_summary] error:', e?.message || e, e?.stack)
      ctx.body = await logFailure(ctx, 'app_stats_summary', 'App stats retrieval failed', e)
    }
  })
}
