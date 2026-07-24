'use strict'

import { eq, and, or as _or, like, desc, inArray } from 'drizzle-orm'
import Router from 'koa-router'
import _moment from 'moment-timezone'
import { sql, func as _func } from '../../lib/index.js'
import { logSuccess, logFailure } from '../../service/audit.js'
import { getCompanyAuthAppIds, requireServiceCompanyScope } from '../../service/serviceScope.js'

const route = new Router()

/**
 * 이메일/전화번호 마스킹
 */
const _maskIdentifier = (identifier, type) => {
  if (!identifier) return '-'
  if (type === 'email') {
    const [local, domain] = identifier.split('@')
    if (!domain) return identifier
    const maskedLocal = local.length > 2
      ? local.substring(0, 2) + '*'.repeat(Math.min(local.length - 2, 4))
      : '*'.repeat(local.length)
    return `${maskedLocal}@${domain}`
  } else if (type === 'phone') {
    if (identifier.length <= 4) return '*'.repeat(identifier.length)
    return identifier.substring(0, 2) + '*'.repeat(identifier.length - 4) + identifier.substring(identifier.length - 2)
  }
  return identifier
}

/**
 * 인증 로그 목록 조회
 */
route.post('/search', async (ctx) => {
  try {
    const body = ctx.request.body || {}
    const page = parseInt(body.page) || 1
    const limit = parseInt(body.limit) || 20
    const offset = (page - 1) * limit
    const companyId = requireServiceCompanyScope(ctx.request.profile, 'search auth logs')
    const scopedAppIds = await getCompanyAuthAppIds(companyId)

    if (scopedAppIds.length === 0) {
      ctx.body = await logSuccess(ctx, 'auth_log_search', 'Auth log search successful', {
        data: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0
        }
      })
      return
    }

    const whereConditions = [inArray(sql.schema.authRequests.appId, scopedAppIds)]

    // 검색 조건
    if (body.status) {
      whereConditions.push(eq(sql.schema.authRequests.status, body.status))
    }
    if (body.app_id !== undefined && body.app_id !== null && body.app_id !== '') {
      whereConditions.push(eq(sql.schema.authRequests.appId, String(body.app_id)))
    }
    if (body.user_id) {
      whereConditions.push(eq(sql.schema.authRequests.userId, body.user_id))
    }
    if (body.country) {
      whereConditions.push(eq(sql.schema.authRequests.country, body.country))
    }
    if (body.request_ip) {
      whereConditions.push(like(sql.schema.authRequests.requestIp, `%${body.request_ip}%`))
    }

    // 날짜 범위 검색
    if (body.start_date) {
      const startTimestamp = new Date(body.start_date).getTime()
      whereConditions.push(sql.sql`${sql.schema.authRequests.createdAt} >= ${startTimestamp}`)
    }
    if (body.end_date) {
      const endTimestamp = new Date(body.end_date).getTime() + 86400000 // 하루 추가
      whereConditions.push(sql.sql`${sql.schema.authRequests.createdAt} <= ${endTimestamp}`)
    }

    // 전체 개수 조회
    const totalResult = await sql.db
      .select({ count: sql.sql`count(*)` })
      .from(sql.schema.authRequests)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .get()

    const total = Number(totalResult?.count ?? 0)

    // 목록 조회
    const authRequests = await sql.db
      .select()
      .from(sql.schema.authRequests)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(desc(sql.schema.authRequests.createdAt))
      .limit(limit)
      .offset(offset)
      .all()

    // 사용자 정보 조회 및 마스킹 (관리자: sys_user, 앱 사용자: app_users)
    const enrichedRequests = await Promise.all(authRequests.map(async (req) => {
      const userIdStr = String(req.userId || '')
      const userIdInt = parseInt(userIdStr, 10)
      let user = null
      let appUser = null
      if (!Number.isNaN(userIdInt)) {
        user = await sql.db
          .select()
          .from(sql.schema.sysUser)
          .where(eq(sql.schema.sysUser.id, userIdInt))
          .limit(1)
          .get()
      } else if (userIdStr.startsWith('usr_')) {
        appUser = await sql.db
          .select({ id: sql.schema.users.id, identifierType: sql.schema.users.identifierType, identifierValue: sql.schema.users.identifierValue })
          .from(sql.schema.users)
          .where(eq(sql.schema.users.id, userIdStr))
          .limit(1)
          .get()
      }

      // 앱 정보 조회: auth_requests.appId는 apps.id(text) → apps 조회 후 sys_application 매핑
      const appRow = await sql.db
        .select()
        .from(sql.schema.apps)
        .where(eq(sql.schema.apps.id, req.appId))
        .limit(1)
        .get()
      const app = appRow ? await sql.db
        .select()
        .from(sql.schema.sysApplication)
        .where(and(
          eq(sql.schema.sysApplication.clientId, appRow.clientId),
          eq(sql.schema.sysApplication.companyId, companyId)
        ))
        .limit(1)
        .get() : null

      // 디바이스 정보 조회 (승인된 경우): APPROVED_BY_DEVICE면 디바이스, APPROVED_BY_EMAIL이면 이메일 인증 표시
      let device = null
      let approvalSource = null // 'device' | 'email'
      if (req.status === 'APPROVED' && req.approvedAt) {
        const approveEvent = await sql.db
          .select()
          .from(sql.schema.authEvents)
          .where(and(
            eq(sql.schema.authEvents.authRequestId, req.id),
            inArray(sql.schema.authEvents.eventType, ['APPROVED', 'APPROVED_BY_DEVICE', 'APPROVED_BY_EMAIL'])
          ))
          .limit(1)
          .get()

        if (approveEvent?.eventType === 'APPROVED_BY_EMAIL') {
          approvalSource = 'email'
          // 이메일 인증 시 deviceType, userAgent 추출
          if (approveEvent.detail) {
            try {
              const emailDetail = JSON.parse(approveEvent.detail)
              if (emailDetail.deviceType || emailDetail.userAgent) {
                device = {
                  deviceName: emailDetail.deviceType || 'PC',
                  platform: 'email',
                  deviceType: emailDetail.deviceType || null,
                  userAgent: emailDetail.userAgent || null
                }
              }
            } catch (e) {
              // JSON 파싱 실패 시 무시
            }
          }
        } else if (approveEvent?.detail) {
          try {
            const detail = JSON.parse(approveEvent.detail)
            if (detail.deviceId) {
              device = await sql.db
                .select()
                .from(sql.schema.devices)
                .where(eq(sql.schema.devices.id, detail.deviceId))
                .limit(1)
                .get()
              approvalSource = 'device'
            }
          } catch (e) {
            // JSON 파싱 실패 시 무시
          }
        }
      }

      // 사용자 식별자 마스킹 (관리자: sys_user, 앱 사용자: app_users identifierValue)
      let maskedIdentifier = '-'
      if (user?.email) {
        const [local, domain] = user.email.split('@')
        if (domain) {
          const maskedLocal = local.length > 2
            ? local.substring(0, 2) + '*'.repeat(Math.min(local.length - 2, 4))
            : '*'.repeat(local.length)
          maskedIdentifier = `${maskedLocal}@${domain}`
        } else {
          maskedIdentifier = user.email
        }
      } else if (user?.name) {
        maskedIdentifier = user.name
      } else if (appUser?.identifierValue) {
        maskedIdentifier = _maskIdentifier(appUser.identifierValue, appUser.identifierType || 'email')
      } else if (appUser) {
        maskedIdentifier = '앱 사용자'
      }

      const deviceName = device ? (device.deviceName || device.platform || '-') : (approvalSource === 'email' ? '이메일 인증' : '-')
      const devicePlatform = device ? device.platform : (approvalSource === 'email' ? 'email' : null)

      return {
        ...req,
        maskedUser: maskedIdentifier,
        appName: app?.name || '-',
        deviceName,
        devicePlatform: devicePlatform || '-',
        // 이메일 인증 시 추가 정보
        deviceType: device?.deviceType || null,
        browserInfo: device?.userAgent || null
      }
    }))

    // logSuccess가 이미 { result, data: responseBody }로 감싸므로, payload에 result 넣지 않음 → 인터셉터가 풀지 않고 { data, pagination } 그대로 반환
    ctx.body = await logSuccess(ctx, 'auth_log_search', 'Auth log search successful', {
      data: enrichedRequests,
      pagination: {
        page,
        limit,
        total,
        totalPages: Number(Math.ceil(total / limit))
      }
    })
  } catch (e) {
    ctx.body = await logFailure(ctx, 'auth_log_search', 'Auth log search failed', e)
  }
})

/**
 * 인증 로그 상세 조회
 */
route.get('/:id', async (ctx) => {
  try {
    const id = ctx.params.id

    if (!id) {
      return ctx.throw(400, 'Invalid auth request ID')
    }
    const companyId = requireServiceCompanyScope(ctx.request.profile, 'view auth logs')
    const scopedAppIds = await getCompanyAuthAppIds(companyId)
    if (scopedAppIds.length === 0) {
      return ctx.throw(404, 'Auth request not found')
    }

    // 인증 요청 조회
    const authRequest = await sql.db
      .select()
      .from(sql.schema.authRequests)
      .where(and(
        eq(sql.schema.authRequests.id, id),
        inArray(sql.schema.authRequests.appId, scopedAppIds)
      ))
      .limit(1)
      .get()

    if (!authRequest) {
      return ctx.throw(404, 'Auth request not found')
    }

    // 타임라인 이벤트 조회
    const events = await sql.db
      .select()
      .from(sql.schema.authEvents)
      .where(eq(sql.schema.authEvents.authRequestId, id))
      .orderBy(sql.schema.authEvents.createdAt)
      .all()

    // 사용자 정보 (관리자: sys_user, 앱 사용자: app_users)
    const userIdStr = String(authRequest.userId || '')
    const userIdInt = parseInt(userIdStr, 10)
    let user = null
    let appUser = null
    if (!Number.isNaN(userIdInt)) {
      user = await sql.db
        .select()
        .from(sql.schema.sysUser)
        .where(eq(sql.schema.sysUser.id, userIdInt))
        .limit(1)
        .get()
    } else if (userIdStr.startsWith('usr_')) {
      appUser = await sql.db
        .select()
        .from(sql.schema.users)
        .where(eq(sql.schema.users.id, userIdStr))
        .limit(1)
        .get()
    }

    // 앱 정보: auth_requests.appId는 sys_apps.id(text) → sys_apps 조회 후 sys_application 매핑
    const appRow = await sql.db
      .select()
      .from(sql.schema.apps)
      .where(eq(sql.schema.apps.id, authRequest.appId))
      .limit(1)
      .get()
    const app = appRow ? await sql.db
      .select()
      .from(sql.schema.sysApplication)
      .where(and(
        eq(sql.schema.sysApplication.clientId, appRow.clientId),
        eq(sql.schema.sysApplication.companyId, companyId)
      ))
      .limit(1)
      .get() : null

    // 승인한 디바이스 정보 (APPROVED_BY_DEVICE일 때만 디바이스 조회, APPROVED_BY_EMAIL은 이메일 인증)
    let approvedDevice = null
    if (authRequest.status === 'APPROVED') {
      const approveEvent = events.find(e => e.eventType === 'APPROVED' || e.eventType === 'APPROVED_BY_DEVICE' || e.eventType === 'APPROVED_BY_EMAIL')
      if (approveEvent?.detail) {
        try {
          const detail = JSON.parse(approveEvent.detail)
          if (detail.deviceId) {
            approvedDevice = await sql.db
              .select()
              .from(sql.schema.devices)
              .where(eq(sql.schema.devices.id, detail.deviceId))
              .limit(1)
              .get()
          }
        } catch (e) {
          // JSON 파싱 실패 시 무시
        }
      }
    }

    // 정책에 의한 차단 여부 확인
    const blockedByPolicy = authRequest.status === 'BLOCKED' ||
      events.some(e => e.eventType === 'BLOCKED' || e.detail?.includes('policy'))

    // 위험 이벤트 조회
    const riskEvents = await sql.db
      .select()
      .from(sql.schema.riskEvents)
      .where(eq(sql.schema.riskEvents.authRequestId, id))
      .all()

    // logSuccess가 이미 { result, data: responseBody }로 감싸므로 payload만 전달 (이중 래핑 방지)
    const detailPayload = {
      ...authRequest,
      user: user ? {
        id: user.id,
        email: user.email,
        name: user.name,
        isActive: user.isActive,
        source: 'sys'
      } : appUser ? {
        id: appUser.id,
        email: appUser.identifierType === 'email' ? _maskIdentifier(appUser.identifierValue, 'email') : null,
        name: appUser.identifierType === 'phone' ? _maskIdentifier(appUser.identifierValue, 'phone') : (appUser.identifierValue ? _maskIdentifier(appUser.identifierValue, appUser.identifierType || 'email') : '앱 사용자'),
        isActive: appUser.status === 'ACTIVE',
        source: 'app'
      } : null,
      app: app ? {
        id: app.id,
        name: app.name,
        clientId: app.clientId
      } : null,
      approvedDevice: approvedDevice ? {
        id: approvedDevice.id,
        platform: approvedDevice.platform,
        deviceName: approvedDevice.deviceName,
        biometricCapable: approvedDevice.biometricCapable
      } : null,
      timeline: events.map(e => ({
        id: e.id,
        eventType: e.eventType,
        detail: e.detail ? (typeof e.detail === 'string' ? JSON.parse(e.detail) : e.detail) : null,
        createdAt: e.createdAt
      })),
      blockedByPolicy,
      riskEvents: riskEvents.map(r => ({
        id: r.id,
        riskType: r.riskType,
        score: r.score,
        action: r.action,
        createdAt: r.createdAt
      }))
    }
    ctx.body = await logSuccess(ctx, 'auth_log_get', 'Auth log retrieved successfully', detailPayload)
  } catch (e) {
    ctx.body = await logFailure(ctx, 'auth_log_get', 'Auth log retrieval failed', e)
  }
})

export default { prefix: '/sys_auth_log', route }
