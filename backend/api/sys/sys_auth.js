'use strict'

import { eq, and, sql as drizzleSql, gte, desc, inArray, isNotNull } from 'drizzle-orm'
import jwt from 'jsonwebtoken'
import Router from 'koa-router'
import _ from 'lodash'
import moment from 'moment-timezone'
import { isFirebaseInitialized } from '../../lib/firebase.js'
import { sql } from '../../lib/index.js'
import { logSuccess, logFailure } from '../../service/audit.js'
import { getCompanyAuthAppIds, requireAdminCompanyScope } from '../../service/serviceScope.js'
import { hashPassword, verifyPassword, needsPasswordRehash, isClientPasswordHash, assertPasswordPolicy } from '../../util/password.js'
import { hashPhoneSha512 } from '../../util/phone.js'

const route = new Router()
const tokenProfileFields = ['email', 'id', 'phone', 'name', 'permissions', 'companyId', 'isAdmin']
const clientUserFields = ['email', 'id', 'phone', 'name', 'permissions', 'companyId', 'isAdmin']

const toTokenProfile = (user) => {
  const profile = _.pick(user, tokenProfileFields)
  profile.isAdmin = resolveIsAdminFlag(profile.permissions)
  return profile
}
const toClientUser = (user) => {
  const clientUser = _.pick(user, clientUserFields)
  return {
    ...clientUser,
    isAdmin: resolveIsAdminFlag(clientUser.permissions),
    company_id: user.companyId
  }
}

function normalizeEmailValue(value) {
  const email = String(value || '').trim().toLowerCase()
  return email || null
}

function resolveCompanyEmail(companyEmail, userEmail) {
  return normalizeEmailValue(companyEmail) || normalizeEmailValue(userEmail) || undefined
}

function resolveIsAdminFlag(permission) {
  const normalizedPermission = String(permission || 'USER').trim().toUpperCase()
  // Legacy SUPER_ADMIN is treated as ADMIN for token/profile flags
  return normalizedPermission === 'ADMIN' || normalizedPermission === 'SUPER_ADMIN'
}

function issueLoginTokens(user) {
  const accessToken = jwt.sign(
    { profile: toTokenProfile(user) },
    global.config.auth.secret,
    { expiresIn: global.config.auth.access }
  )
  const refreshToken = jwt.sign(
    { id: user.id, type: 'refresh' },
    global.config.auth.secret,
    { expiresIn: global.config.auth.refresh }
  )
  return { accessToken, refreshToken }
}

// 리프레시 토큰으로 액세스 토큰 갱신
route.get('/refresh/:ts', async (ctx) => {
  try {
    const authHeader = ctx.request.header['authorization'] || ctx.request.header['Authorization']
    if (!authHeader) {
      return ctx.throw(401, 'Authorization header is required')
    }

    const refreshToken = authHeader.replace(/bearer /gi, '')
    if (!refreshToken) {
      return ctx.throw(401, 'Refresh token is required')
    }

    const serverTime = new Date().getTime()
    const clientTime = parseInt(ctx.params.ts, 10)
    if (!Number.isFinite(clientTime)) {
      ctx.body = await logFailure(ctx, 'token_refresh', 'Token refresh failed', {
        result: false,
        message: 'Invalid client timestamp'
      })
      return
    }
    const timeDiff = Math.abs(serverTime - clientTime)

    if (timeDiff > 3600000) { // 1시간 = 3600000 밀리초
      ctx.body = await logFailure(ctx, 'token_refresh', 'Token refresh failed', {
        result: false,
        message: `Client time is too different from server time(${Math.floor(timeDiff / 1000 / 60)} minutes)`
      })
      return
    }

    // Verify the refresh token

    const decoded = await jwt.verify(refreshToken, global.config.auth.secret)
    if (decoded.type !== 'refresh') {
      ctx.body = await logFailure(ctx, 'token_refresh', 'Token refresh failed', {
        result: false,
        message: 'Token type error'
      })
      return
    }

    // Get user info from database to ensure user still exists and is active
    const user = await sql.db.select().from(sql.schema.sysUser)
      .where(and(
        eq(sql.schema.sysUser.id, decoded.id),
        eq(sql.schema.sysUser.isActive, true),
        eq(sql.schema.sysUser.isDel, false)
      ))
      .limit(1)
      .get()

    if (!user) {
      throw new Error('User not found or inactive')
    }

    // Generate new access token
    const accessToken = jwt.sign(
      { profile: toTokenProfile(user) },
      global.config.auth.secret,
      { expiresIn: global.config.auth.access }
    )

    ctx.body = await logSuccess(ctx, 'token_refresh', 'Token refreshed successfully', {
      result: true,
      data: {
        accessToken
      }
    })
  } catch (e) {
    await logFailure(ctx, 'token_refresh', 'Token refresh failed', e)
    ctx.throw(403, e.message)
  }
})

route.post('/signin', async (ctx) => {
  try {
    const body = ctx.request.body

    const rs = await sql.db.select().from(sql.schema.sysUser)
      .where(eq(sql.schema.sysUser.email, body.email))
      .limit(1)
      .get()

    if (!rs) {
      ctx.body = await logFailure(ctx, 'login', 'Login failed', {
        code: 'AUTH_INVALID_CREDENTIALS',
        message: 'invalid email or password'
      })
      return
    }
    if (rs.isDel || !rs.isActive) {
      ctx.body = await logFailure(ctx, 'login', 'Login failed', {
        code: 'AUTH_ACCOUNT_INACTIVE',
        message: 'account is inactive'
      })
      return
    }

    const isPasswordHashed = isClientPasswordHash(body.password)
    if (!verifyPassword(body.email, body.password, rs.password, isPasswordHashed)) {
      ctx.body = await logFailure(ctx, 'login', 'Login failed', {
        code: 'AUTH_INVALID_CREDENTIALS',
        message: 'invalid email or password'
      })
      return
    }

    const updateFields = {
      lastVisitedAt: drizzleSql`now()`,
      updatedAt: drizzleSql`now()`
    }
    if (needsPasswordRehash(rs.password)) {
      updateFields.password = hashPassword(body.email, body.password, isPasswordHashed)
    }

    await sql.db.update(sql.schema.sysUser)
      .set(updateFields)
      .where(eq(sql.schema.sysUser.id, rs.id))
      .returning()

    const { accessToken, refreshToken } = issueLoginTokens(rs)
    ctx.request.profile = toTokenProfile(rs)

    ctx.body = await logSuccess(ctx, 'login', 'Login successful', {
      result: true,
      data: {
        user: toClientUser(rs),
        accessToken,
        refreshToken
      }
    })
  } catch (e) {
    console.log(e.message)
    ctx.body = await logFailure(ctx, 'login', 'Login failed', e.message || 'Login error')
  }
})

route.get('/setup/status', async (ctx) => {
  try {
    const { needsInitialSetup } = await import('../../util/init/init_postgres.js')
    const needsSetup = await needsInitialSetup()
    ctx.body = await logSuccess(ctx, 'setup_status', 'Setup status', {
      result: true,
      data: { needsSetup }
    })
  } catch (e) {
    ctx.body = await logFailure(ctx, 'setup_status', 'Setup status failed', e)
  }
})

route.post('/setup', async (ctx) => {
  try {
    const { needsInitialSetup, markSetupCompleted, withSetupLock } = await import('../../util/init/init_postgres.js')

    const body = ctx.request.body || {}
    const email = normalizeEmailValue(body.email)
    const name = String(body.name || '').trim()
    const password = body.password
    const companyName = String(body.company_name || body.companyName || '').trim()
      || (email ? email.split('@')[0] : '')
      || 'Organization'

    if (!email || !name || !password) {
      ctx.status = 400
      ctx.body = await logFailure(ctx, 'setup', 'Initial setup failed', {
        code: 'SETUP_REQUIRED_FIELDS',
        message: 'name, email, and password are required'
      })
      return
    }

    const passwordPolicy = assertPasswordPolicy(password)
    if (!passwordPolicy.ok) {
      ctx.status = 400
      ctx.body = await logFailure(ctx, 'setup', 'Initial setup failed', {
        code: passwordPolicy.code || 'PASSWORD_POLICY',
        message: passwordPolicy.message
      })
      return
    }

    const result = await withSetupLock(async () => {
      if (!(await needsInitialSetup())) {
        return { alreadyDone: true }
      }

      const company = await sql.db.insert(sql.schema.sysCompany).values({
        name: companyName,
        email: resolveCompanyEmail(body.company_email ?? body.companyEmail, email),
        isActive: true
      }).returning().get()

      const isPasswordHashed = isClientPasswordHash(password)
      const hashedPassword = hashPassword(email, password, isPasswordHashed)
      const permission = 'ADMIN'

      const user = await sql.db.insert(sql.schema.sysUser).values({
        email,
        password: hashedPassword,
        name,
        phone: body.phone || undefined,
        phoneSha512: hashPhoneSha512(body.phone) ?? undefined,
        companyId: company.id,
        permissions: permission,
        isActive: true,
        isVerify: true,
        isAdmin: resolveIsAdminFlag(permission),
        lastVisitedAt: drizzleSql`now()`
      }).returning().get()

      await markSetupCompleted()
      return { user }
    })

    if (result.alreadyDone) {
      ctx.status = 403
      ctx.body = await logFailure(
        ctx,
        'setup',
        'Initial setup already completed',
        {
          code: 'SETUP_ALREADY_COMPLETED',
          message: 'An administrator already exists. Use login instead.'
        }
      )
      return
    }

    const { accessToken, refreshToken } = issueLoginTokens(result.user)
    ctx.request.profile = toTokenProfile(result.user)

    ctx.body = await logSuccess(ctx, 'setup', 'Initial setup successful', {
      result: true,
      data: {
        user: toClientUser(result.user),
        accessToken,
        refreshToken
      }
    })
  } catch (e) {
    const status = e.status || e.statusCode
    if (status) ctx.status = status
    ctx.body = await logFailure(ctx, 'setup', 'Initial setup failed', e)
  }
})

route.get('/logout', async (ctx) => {
  try {
    ctx.body = await logSuccess(ctx, 'logout', 'Logout successful', { result: true })
  } catch (e) {
    ctx.body = await logFailure(ctx, 'logout', 'Logout failed', e)
  }
})

/**
 * 대시보드 데이터 조회
 */
route.get('/dashboard', async (ctx) => {
  try {
    const now = Date.now()
    // 최근 7일(오늘 포함) 통계 기준. 하루 단위로 정렬된 7일 윈도우의 시작 시각.
    const weekStart = moment().startOf('day').subtract(6, 'days').valueOf()
    const companyId = requireAdminCompanyScope(ctx.request.profile, 'view dashboard')
    const scopedAppIds = await getCompanyAuthAppIds(companyId)

    const emptyDashboardData = {
      kpi: {
        weekRequestsCount: 0,
        successRate: 0,
        avgTimeSeconds: 0,
        pendingCount: 0
      },
      statusDistribution: {
        APPROVED: 0,
        DENIED: 0,
        EXPIRED: 0,
        BLOCKED: 0,
        CONSUMED: 0,
        PENDING: 0,
        CREATED: 0
      },
      dailyTrend: Array.from({ length: 7 }, (_, i) => ({ day: i, count: 0 })),
      recentRequests: [],
      riskEvents: {
        NEW_DEVICE: 0,
        COUNTRY_CHANGE: 0,
        ABUSE: 0
      },
      weekSuccessCount: 0,
      firebaseConfigured: isFirebaseInitialized()
    }

    if (scopedAppIds.length === 0) {
      ctx.body = await logSuccess(ctx, 'dashboard_get', 'Dashboard data retrieved successfully', {
        result: true,
        data: emptyDashboardData
      })
      return
    }

    // 집계 대상 상태: CREATED(요청만 생성되고 진행되지 않은 건)는 인증 요청으로 세지 않는다.
    const COUNTABLE_STATUSES = ['PENDING', 'APPROVED', 'CONSUMED', 'DENIED', 'EXPIRED', 'BLOCKED']

    // 1. 최근 7일 인증 요청 수
    const weekRequestsResult = await sql.db
      .select({ count: sql.sql`count(*)` })
      .from(sql.schema.authRequests)
      .where(and(
        gte(sql.schema.authRequests.createdAt, weekStart),
        inArray(sql.schema.authRequests.appId, scopedAppIds),
        inArray(sql.schema.authRequests.status, COUNTABLE_STATUSES)
      ))
      .get()
    const weekRequestsCount = Number(weekRequestsResult?.count ?? 0)

    // 2. 인증 성공률 (성공 / (성공 + DENIED + EXPIRED))
    // 성공 종료 상태는 APPROVED(앱 미설치 경로 등 직행)와 CONSUMED(토큰 교환 완료) 모두 포함한다.
    const successStats = await sql.db
      .select({
        status: sql.schema.authRequests.status,
        count: sql.sql`count(*)`
      })
      .from(sql.schema.authRequests)
      .where(
        and(
          gte(sql.schema.authRequests.createdAt, weekStart),
          inArray(sql.schema.authRequests.appId, scopedAppIds),
          inArray(sql.schema.authRequests.status, ['APPROVED', 'CONSUMED', 'DENIED', 'EXPIRED'])
        )
      )
      .groupBy(sql.schema.authRequests.status)
      .all()

    const approved = Number(successStats.find(s => s.status === 'APPROVED')?.count ?? 0)
    const consumed = Number(successStats.find(s => s.status === 'CONSUMED')?.count ?? 0)
    const denied = Number(successStats.find(s => s.status === 'DENIED')?.count ?? 0)
    const expired = Number(successStats.find(s => s.status === 'EXPIRED')?.count ?? 0)
    const successCount = approved + consumed
    const total = successCount + denied + expired
    const successRate = total > 0 ? ((successCount / total) * 100).toFixed(2) : '0.00'

    // 3. 평균 인증 소요 시간 (초)
    const avgTimeResult = await sql.db
      .select({
        avgTime: sql.sql`avg(${sql.schema.authRequests.approvedAt} - ${sql.schema.authRequests.createdAt})`
      })
      .from(sql.schema.authRequests)
      .where(
        and(
          gte(sql.schema.authRequests.createdAt, weekStart),
          inArray(sql.schema.authRequests.appId, scopedAppIds),
          inArray(sql.schema.authRequests.status, ['APPROVED', 'CONSUMED']),
          isNotNull(sql.schema.authRequests.approvedAt)
        )
      )
      .get()
    const avgTimeSeconds = avgTimeResult?.avgTime ? (avgTimeResult.avgTime / 1000).toFixed(2) : '0.00'

    // 4. 현재 대기 중 인증 요청 수
    const pendingResult = await sql.db
      .select({ count: sql.sql`count(*)` })
      .from(sql.schema.authRequests)
      .where(
        and(
          eq(sql.schema.authRequests.status, 'PENDING'),
          inArray(sql.schema.authRequests.appId, scopedAppIds),
          sql.sql`${sql.schema.authRequests.expiresAt} > ${now}`
        )
      )
      .get()
    const pendingCount = Number(pendingResult?.count ?? 0)

    // 5. 인증 상태 분포 (최근 7일)
    const statusDistribution = await sql.db
      .select({
        status: sql.schema.authRequests.status,
        count: sql.sql`count(*)`
      })
      .from(sql.schema.authRequests)
      .where(and(
        gte(sql.schema.authRequests.createdAt, weekStart),
        inArray(sql.schema.authRequests.appId, scopedAppIds)
      ))
      .groupBy(sql.schema.authRequests.status)
      .all()

    // 상태별 카운트 맵 생성
    const statusMap = {
      APPROVED: 0,
      DENIED: 0,
      EXPIRED: 0,
      BLOCKED: 0,
      CONSUMED: 0,
      PENDING: 0,
      CREATED: 0
    }
    statusDistribution.forEach(item => {
      statusMap[item.status] = Number(item.count ?? 0)
    })

    // 6. 일자별 인증 요청 추이 (최근 7일)
    const dailyRequests = await sql.db
      .select({
        day: sql.sql`cast(((${sql.schema.authRequests.createdAt} - ${weekStart}) / 86400000) as integer) as day`,
        count: sql.sql`count(*)`
      })
      .from(sql.schema.authRequests)
      .where(and(
        gte(sql.schema.authRequests.createdAt, weekStart),
        inArray(sql.schema.authRequests.appId, scopedAppIds),
        inArray(sql.schema.authRequests.status, COUNTABLE_STATUSES)
      ))
      .groupBy(sql.sql`day`)
      .all()

    // 7일 데이터 초기화 (0으로 채움)
    const dailyData = Array.from({ length: 7 }, (_, i) => {
      const dayData = dailyRequests.find(d => d.day === i)
      return {
        day: i,
        count: dayData ? Number(dayData.count ?? 0) : 0
      }
    })

    // 7. 최근 인증 요청 목록 (10건)
    const recentRequests = await sql.db
      .select({
        id: sql.schema.authRequests.id,
        createdAt: sql.schema.authRequests.createdAt,
        status: sql.schema.authRequests.status,
        country: sql.schema.authRequests.country,
        userAgent: sql.schema.authRequests.userAgent,
        appId: sql.schema.authRequests.appId,
        userId: sql.schema.authRequests.userId,
        appName: sql.schema.apps.name,
        userEmail: sql.schema.sysUser.email,
        userName: sql.schema.sysUser.name
      })
      .from(sql.schema.authRequests)
      .leftJoin(sql.schema.apps, eq(sql.schema.authRequests.appId, sql.schema.apps.id))
      .leftJoin(sql.schema.sysUser, eq(sql.schema.authRequests.userId, sql.sql`CAST(${sql.schema.sysUser.id} AS TEXT)`))
      .where(inArray(sql.schema.authRequests.appId, scopedAppIds))
      .orderBy(desc(sql.schema.authRequests.createdAt))
      .limit(10)
      .all()

    // 각 요청별 디바이스 정보 조회 (첫 번째 디바이스만)
    const formattedRecentRequests = await Promise.all(recentRequests.map(async (req) => {
      // 사용자별 첫 번째 디바이스 조회
      let devicePlatform = 'N/A'
      if (req.userId) {
        const device = await sql.db
          .select({ platform: sql.schema.devices.platform })
          .from(sql.schema.devices)
          .where(eq(sql.schema.devices.userId, req.userId))
          .limit(1)
          .get()
        if (device) {
          devicePlatform = device.platform
        }
      }

      // 사용자 식별자 마스킹 처리
      let maskedIdentifier = 'N/A'
      if (req.userEmail) {
        const email = req.userEmail
        const [local, domain] = email.split('@')
        if (domain) {
          const maskedLocal = local.length > 2
            ? local.substring(0, 2) + '*'.repeat(Math.min(local.length - 2, 4))
            : '*'.repeat(local.length)
          maskedIdentifier = `${maskedLocal}@${domain}`
        } else {
          maskedIdentifier = email
        }
      } else if (req.userName) {
        maskedIdentifier = req.userName
      }

      return {
        id: req.id,
        createdAt: req.createdAt,
        status: req.status,
        country: req.country || 'N/A',
        devicePlatform: devicePlatform,
        appName: req.appName || 'N/A',
        userIdentifier: maskedIdentifier
      }
    }))

    // 8. 위험 이벤트 요약 (최근 7일)
    const riskEvents = await sql.db
      .select({
        riskType: sql.schema.riskEvents.riskType,
        count: sql.sql`count(*)`
      })
      .from(sql.schema.riskEvents)
      .innerJoin(sql.schema.authRequests, eq(sql.schema.riskEvents.authRequestId, sql.schema.authRequests.id))
      .where(and(
        gte(sql.schema.riskEvents.createdAt, weekStart),
        inArray(sql.schema.authRequests.appId, scopedAppIds)
      ))
      .groupBy(sql.schema.riskEvents.riskType)
      .all()

    const riskMap = {
      NEW_DEVICE: 0,
      COUNTRY_CHANGE: 0,
      ABUSE: 0
    }
    riskEvents.forEach(item => {
      if (riskMap.hasOwnProperty(item.riskType)) {
        riskMap[item.riskType] = Number(item.count ?? 0)
      }
    })

    // 9. 최근 7일 인증 성공 건수 (APPROVED + CONSUMED)
    const weekSuccessCount = successCount

    ctx.body = await logSuccess(ctx, 'dashboard_get', 'Dashboard data retrieved successfully', {
      result: true,
      data: {
        kpi: {
          weekRequestsCount,
          successRate: parseFloat(successRate),
          avgTimeSeconds: parseFloat(avgTimeSeconds),
          pendingCount
        },
        statusDistribution: statusMap,
        dailyTrend: dailyData,
        recentRequests: formattedRecentRequests,
        riskEvents: riskMap,
        weekSuccessCount,
        firebaseConfigured: isFirebaseInitialized()
      }
    })
  } catch (e) {
    ctx.body = await logFailure(ctx, 'dashboard_get', 'Failed to retrieve dashboard data', e)
  }
})

export default { prefix: '/auth', route }
