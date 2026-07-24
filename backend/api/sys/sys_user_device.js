'use strict'

import { eq, and, or as _or, like, desc, isNull, inArray } from 'drizzle-orm'
import Router from 'koa-router'
import _moment from 'moment-timezone'
import { sql, func as _func } from '../../lib/index.js'
import { logSuccess, logFailure } from '../../service/audit.js'
import { getCompanyAuthAppIds, requireServiceCompanyScope } from '../../service/serviceScope.js'

const route = new Router()

/** 앱 회원가입 사용자만 표시 (서비스 > 사용자 관리 > 사용자) */
const SIGNUP_SOURCE_APP = 'app_signup'

const buildEmptyPage = (page, limit) => ({
  data: [],
  pagination: {
    page,
    limit,
    total: 0,
    totalPages: 0
  }
})

const getScopedUserIds = async (appIds) => {
  if (!appIds.length) return []

  const rows = await sql.db
    .select({ userId: sql.schema.authRequests.userId })
    .from(sql.schema.authRequests)
    .where(inArray(sql.schema.authRequests.appId, appIds))
    .groupBy(sql.schema.authRequests.userId)
    .all()

  return rows.map((row) => row.userId).filter(Boolean)
}

const getScopedUserIdsForProfile = async (profile, action) => {
  const companyId = requireServiceCompanyScope(profile, action)
  const appIds = await getCompanyAuthAppIds(companyId)
  const userIds = await getScopedUserIds(appIds)
  return { companyId, appIds, userIds }
}

const ensureScopedAppUser = async ({ id, userIds }) => {
  if (!userIds.includes(id)) return null

  return sql.db
    .select()
    .from(sql.schema.users)
    .where(and(
      eq(sql.schema.users.id, id),
      eq(sql.schema.users.signupSource, SIGNUP_SOURCE_APP)
    ))
    .limit(1)
    .get()
}

/**
 * 사용자 목록 조회 (app_users 중 앱 회원가입(signup_source=app_signup)만)
 */
route.post('/users/search', async (ctx) => {
  try {
    const body = ctx.request.body || {}
    const page = parseInt(body.page) || 1
    const limit = parseInt(body.limit) || 20
    const offset = (page - 1) * limit
    const { userIds } = await getScopedUserIdsForProfile(ctx.request.profile, 'search service users')

    if (userIds.length === 0) {
      ctx.body = await logSuccess(ctx, 'user_device_search', 'User device search successful', buildEmptyPage(page, limit))
      return
    }

    const whereConditions = [
      eq(sql.schema.users.signupSource, SIGNUP_SOURCE_APP),
      inArray(sql.schema.users.id, userIds)
    ]

    if (body.status) {
      whereConditions.push(eq(sql.schema.users.status, body.status))
    }
    if (body.identifier_type) {
      whereConditions.push(eq(sql.schema.users.identifierType, body.identifier_type))
    }
    if (body.identifier_value && String(body.identifier_value).trim()) {
      whereConditions.push(like(sql.schema.users.identifierValue, `%${String(body.identifier_value).trim()}%`))
    }

    const whereClause = and(...whereConditions)

    // 전체 개수 조회
    const totalResult = await sql.db
      .select({ count: sql.sql`count(*)` })
      .from(sql.schema.users)
      .where(whereClause)
      .get()

    const total = Number(totalResult?.count ?? 0)

    // 목록 조회
    const users = await sql.db
      .select()
      .from(sql.schema.users)
      .where(whereClause)
      .orderBy(desc(sql.schema.users.lastLoginAt))
      .limit(limit)
      .offset(offset)
      .all()

    // 각 사용자별 디바이스 수 조회 (revokedAt IS NULL만 집계)
    const enrichedUsers = await Promise.all(users.map(async (user) => {
      const deviceCount = await sql.db
        .select({ count: sql.sql`count(*)` })
        .from(sql.schema.devices)
        .where(and(
          eq(sql.schema.devices.userId, user.id),
          isNull(sql.schema.devices.revokedAt)
        ))
        .get()

      const count = deviceCount?.count != null ? Number(deviceCount.count) : 0
      return {
        ...user,
        deviceCount: count,
        identifier: user.identifierValue ?? user.identifierHash
      }
    }))

    ctx.body = await logSuccess(ctx, 'user_device_search', 'User device search successful', {
      data: enrichedUsers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Number(Math.ceil(total / limit))
      }
    })
  } catch (e) {
    ctx.body = await logFailure(ctx, 'user_device_search', 'User device search failed', e)
  }
})

/**
 * 사용자 상세 조회 (app_users, id는 문자열 usr_xxx)
 */
route.get('/users/:id', async (ctx) => {
  try {
    const id = ctx.params.id

    if (!id || typeof id !== 'string') {
      return ctx.throw(400, 'Invalid user ID')
    }
    const { appIds, userIds } = await getScopedUserIdsForProfile(ctx.request.profile, 'view service users')

    const user = await ensureScopedAppUser({ id, userIds })

    if (!user) {
      return ctx.throw(404, 'User not found')
    }

    const devices = await sql.db
      .select()
      .from(sql.schema.devices)
      .where(eq(sql.schema.devices.userId, id))
      .orderBy(desc(sql.schema.devices.lastSeenAt))
      .all()

    const authHistory = await sql.db
      .select()
      .from(sql.schema.authRequests)
      .where(and(
        eq(sql.schema.authRequests.userId, id),
        inArray(sql.schema.authRequests.appId, appIds)
      ))
      .orderBy(desc(sql.schema.authRequests.createdAt))
      .limit(50)
      .all()

    ctx.body = await logSuccess(ctx, 'user_device_get', 'User device retrieved successfully', {
      ...user,
      identifier: user.identifierValue ?? user.identifierHash,
      devices: devices.map(d => ({
        ...d,
        isRevoked: !!d.revokedAt,
        isTrusted: d.trustedUntil && d.trustedUntil > Date.now()
      })),
      authHistory: authHistory.map(a => ({
        id: a.id,
        appId: a.appId,
        status: a.status,
        requestIp: a.requestIp,
        country: a.country,
        createdAt: a.createdAt
      }))
    })
  } catch (e) {
    ctx.body = await logFailure(ctx, 'user_device_get', 'User device retrieval failed', e)
  }
})

/**
 * 모든 디바이스 로그아웃
 */
route.post('/users/:id/logout-all', async (ctx) => {
  try {
    const id = ctx.params.id

    if (!id) {
      return ctx.throw(400, 'Invalid user ID')
    }

    const { userIds } = await getScopedUserIdsForProfile(ctx.request.profile, 'manage user devices')
    const user = await ensureScopedAppUser({ id, userIds })
    if (!user) {
      return ctx.throw(404, 'User not found')
    }

    // 모든 디바이스 revoke
    await sql.db
      .update(sql.schema.devices)
      .set({
        revokedAt: Date.now(),
        trustedUntil: null
      })
      .where(and(
        eq(sql.schema.devices.userId, id),
        isNull(sql.schema.devices.revokedAt)
      ))

    ctx.body = await logSuccess(ctx, 'user_logout_all', 'All devices logged out successfully', {
      result: true
    })
  } catch (e) {
    ctx.body = await logFailure(ctx, 'user_logout_all', 'Logout all devices failed', e)
  }
})

/**
 * 사용자 인증 일시 차단 (app_users.status = BLOCKED)
 */
route.post('/users/:id/block', async (ctx) => {
  try {
    const id = ctx.params.id
    const body = ctx.request.body || {}

    if (!id || typeof id !== 'string') {
      return ctx.throw(400, 'Invalid user ID')
    }

    const { userIds } = await getScopedUserIdsForProfile(ctx.request.profile, 'manage user devices')
    const user = await ensureScopedAppUser({ id, userIds })
    if (!user) {
      return ctx.throw(404, 'User not found')
    }

    const blockUntil = body.block_until ? new Date(body.block_until).getTime() : null

    await sql.db
      .update(sql.schema.users)
      .set({ status: 'BLOCKED' })
      .where(and(
        eq(sql.schema.users.id, id),
        eq(sql.schema.users.signupSource, SIGNUP_SOURCE_APP)
      ))

    ctx.body = await logSuccess(ctx, 'user_block', 'User blocked successfully', { blockUntil })
  } catch (e) {
    ctx.body = await logFailure(ctx, 'user_block', 'User block failed', e)
  }
})

/**
 * 사용자 차단 해제 (app_users.status = ACTIVE)
 */
route.post('/users/:id/unblock', async (ctx) => {
  try {
    const id = ctx.params.id

    if (!id || typeof id !== 'string') {
      return ctx.throw(400, 'Invalid user ID')
    }

    const { userIds } = await getScopedUserIdsForProfile(ctx.request.profile, 'manage user devices')
    const user = await ensureScopedAppUser({ id, userIds })
    if (!user) {
      return ctx.throw(404, 'User not found')
    }

    await sql.db
      .update(sql.schema.users)
      .set({ status: 'ACTIVE' })
      .where(and(
        eq(sql.schema.users.id, id),
        eq(sql.schema.users.signupSource, SIGNUP_SOURCE_APP)
      ))

    ctx.body = await logSuccess(ctx, 'user_unblock', 'User unblocked successfully', {
      result: true
    })
  } catch (e) {
    ctx.body = await logFailure(ctx, 'user_unblock', 'User unblock failed', e)
  }
})

/**
 * 디바이스 강제 revoke
 */
route.post('/devices/:id/revoke', async (ctx) => {
  try {
    const id = ctx.params.id

    if (!id) {
      return ctx.throw(400, 'Invalid device ID')
    }

    const { userIds } = await getScopedUserIdsForProfile(ctx.request.profile, 'manage user devices')
    const device = await sql.db
      .select()
      .from(sql.schema.devices)
      .where(and(
        eq(sql.schema.devices.id, id),
        inArray(sql.schema.devices.userId, userIds)
      ))
      .limit(1)
      .get()
    if (!device) {
      return ctx.throw(404, 'Device not found')
    }

    // 디바이스 revoke
    await sql.db
      .update(sql.schema.devices)
      .set({
        revokedAt: Date.now(),
        trustedUntil: null
      })
      .where(eq(sql.schema.devices.id, id))

    ctx.body = await logSuccess(ctx, 'device_revoke', 'Device revoked successfully', {})
  } catch (e) {
    ctx.body = await logFailure(ctx, 'device_revoke', 'Device revoke failed', e)
  }
})

/**
 * 디바이스 목록 조회
 */
route.post('/devices/search', async (ctx) => {
  try {
    const body = ctx.request.body || {}
    const page = parseInt(body.page) || 1
    const limit = parseInt(body.limit) || 20
    const offset = (page - 1) * limit
    const { userIds } = await getScopedUserIdsForProfile(ctx.request.profile, 'search devices')

    if (userIds.length === 0) {
      ctx.body = await logSuccess(ctx, 'device_search', 'Device search successful', buildEmptyPage(page, limit))
      return
    }

    const whereConditions = [inArray(sql.schema.devices.userId, userIds)]

    if (body.user_id) {
      whereConditions.push(eq(sql.schema.devices.userId, body.user_id))
    }
    if (body.platform) {
      whereConditions.push(eq(sql.schema.devices.platform, body.platform))
    }
    if (body.revoked !== undefined) {
      if (body.revoked) {
        whereConditions.push(sql.sql`${sql.schema.devices.revokedAt} IS NOT NULL`)
      } else {
        whereConditions.push(isNull(sql.schema.devices.revokedAt))
      }
    }

    // 전체 개수 조회
    const totalResult = await sql.db
      .select({ count: sql.sql`count(*)` })
      .from(sql.schema.devices)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .get()

    const total = Number(totalResult?.count ?? 0)

    // 목록 조회
    const devices = await sql.db
      .select()
      .from(sql.schema.devices)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(desc(sql.schema.devices.lastSeenAt))
      .limit(limit)
      .offset(offset)
      .all()

    // 사용자 정보 조인 (app_users)
    const enrichedDevices = await Promise.all(devices.map(async (device) => {
      const user = await sql.db
        .select()
        .from(sql.schema.users)
        .where(eq(sql.schema.users.id, device.userId))
        .limit(1)
        .get()

      return {
        ...device,
        user: user ? {
          id: user.id,
          identifierType: user.identifierType,
          identifierHash: user.identifierHash,
          identifierValue: user.identifierValue
        } : null,
        isRevoked: !!device.revokedAt,
        isTrusted: device.trustedUntil && device.trustedUntil > Date.now()
      }
    }))

    ctx.body = await logSuccess(ctx, 'device_search', 'Device search successful', {
      data: enrichedDevices,
      pagination: {
        page,
        limit,
        total,
        totalPages: Number(Math.ceil(total / limit))
      }
    })
  } catch (e) {
    ctx.body = await logFailure(ctx, 'device_search', 'Device search failed', e)
  }
})

export default { prefix: '/sys_user_device', route }
