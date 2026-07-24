'use strict'

import { eq, and, or as _or, like, ne as _ne, desc, isNull } from 'drizzle-orm'
import Router from 'koa-router'
import { randomBytesHex } from '../../lib/forge.js'
import { sql, func as _func } from '../../lib/index.js'
import { logSuccess, logFailure } from '../../service/audit.js'
import { requireServiceCompanyScope } from '../../service/serviceScope.js'

const route = new Router()

/**
 * Client ID 생성
 */
const generateClientId = () => {
  return 'app_' + randomBytesHex(16)
}

/**
 * Client Secret 생성
 */
const generateClientSecret = () => {
  return 'secret_' + randomBytesHex(32)
}

const LEGACY_DEFAULT_COMPANY_ID = 1

const getApplicationCompanyScopeCondition = (companyId) => {
  const conditions = [eq(sql.schema.sysApplication.companyId, companyId)]

  if (companyId === LEGACY_DEFAULT_COMPANY_ID) {
    conditions.push(isNull(sql.schema.sysApplication.companyId))
  }

  return conditions.length === 1 ? conditions[0] : _or(...conditions)
}

const findScopedApplicationById = async (id, companyId) => {
  const scopeCondition = getApplicationCompanyScopeCondition(companyId)
  return sql.db
    .select()
    .from(sql.schema.sysApplication)
    .where(and(
      eq(sql.schema.sysApplication.id, id),
      scopeCondition,
      eq(sql.schema.sysApplication.isDel, false)
    ))
    .limit(1)
    .get()
}

/**
 * Keep app_sys_apps (runtime OAuth mirror) in sync with sys_application.
 */
const syncRuntimeApp = async (application) => {
  if (!application?.clientId) return
  const existing = await sql.db
    .select()
    .from(sql.schema.apps)
    .where(eq(sql.schema.apps.clientId, application.clientId))
    .limit(1)
    .get()

  const status = (application.isDel || application.isActive === false) ? 'INACTIVE' : 'ACTIVE'
  const payload = {
    orgId: application.companyId || LEGACY_DEFAULT_COMPANY_ID,
    name: application.name,
    clientId: application.clientId,
    clientSecret: application.clientSecret,
    redirectUri: application.callbackUrl || '',
    status
  }

  if (existing) {
    await sql.db
      .update(sql.schema.apps)
      .set(payload)
      .where(eq(sql.schema.apps.clientId, application.clientId))
    return
  }

  await sql.db.insert(sql.schema.apps).values({
    id: `sys_${application.id}`,
    ...payload,
    createdAt: Date.now()
  })
}

/**
 * 애플리케이션 목록 조회
 */
route.post('/search', async (ctx) => {
  try {
    const body = ctx.request.body || {}
    const page = parseInt(body.page) || 1
    const limit = parseInt(body.limit) || 20
    const offset = (page - 1) * limit
    const companyId = requireServiceCompanyScope(ctx.request.profile, 'search applications')
    const scopeCondition = getApplicationCompanyScopeCondition(companyId)

    const whereConditions = [
      eq(sql.schema.sysApplication.isDel, false),
      scopeCondition
    ]

    // 검색 조건
    if (body.name) {
      whereConditions.push(like(sql.schema.sysApplication.name, `%${body.name}%`))
    }
    if (body.client_id) {
      whereConditions.push(like(sql.schema.sysApplication.clientId, `%${body.client_id}%`))
    }
    if (body.is_active !== undefined) {
      whereConditions.push(eq(sql.schema.sysApplication.isActive, body.is_active))
    }

    // 전체 개수 조회
    const totalResult = await sql.db
      .select({ count: sql.sql`count(*)` })
      .from(sql.schema.sysApplication)
      .where(and(...whereConditions))
      .get()

    const total = Number(totalResult?.count ?? 0)

    // 목록 조회
    const applications = await sql.db
      .select()
      .from(sql.schema.sysApplication)
      .where(and(...whereConditions))
      .orderBy(desc(sql.schema.sysApplication.createdAt))
      .limit(limit)
      .offset(offset)
      .all()

    // Client Secret은 제외하고 반환
    const safeApplications = applications.map(app => {
      const { clientSecret: _clientSecret, allowedCountries: _allowedCountries, ...safeApp } = app
      return safeApp
    })

    ctx.body = await logSuccess(ctx, 'application_search', 'Application search successful', {
      data: safeApplications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Number(Math.ceil(total / limit))
      }
    })
  } catch (e) {
    ctx.body = await logFailure(ctx, 'application_search', 'Application search failed', e)
  }
})

/**
 * 애플리케이션 생성
 */
route.post('/create', async (ctx) => {
  try {
    const body = ctx.request.body

    const companyId = requireServiceCompanyScope(ctx.request.profile, 'create applications')

    // 필수 필드 검증
    if (!body.name) {
      return ctx.throw(400, 'Name is required')
    }

    // Client ID 중복 검사
    const clientId = body.client_id || generateClientId()
    const existingApp = await sql.db
      .select()
      .from(sql.schema.sysApplication)
      .where(eq(sql.schema.sysApplication.clientId, clientId))
      .limit(1)
      .get()

    if (existingApp) {
      return ctx.throw(400, 'Client ID already exists')
    }

    // 애플리케이션 데이터 준비
    const appData = {
      name: body.name,
      clientId: clientId,
      clientSecret: generateClientSecret(),
      callbackUrl: body.callback_url || '',
      companyId,
      userId: ctx.request.profile.id,
      isActive: body.is_active !== undefined ? body.is_active : true,
      loginIdentifier: body.login_identifier || 'both',
      authRequestExpiry: body.auth_request_expiry ?? 60,
      duplicateRequestLimit: body.duplicate_request_limit ?? 2
    }

    // 애플리케이션 생성
    const application = await sql.db
      .insert(sql.schema.sysApplication)
      .values(appData)
      .returning()
      .get()

    await syncRuntimeApp(application)

    // Client Secret은 한 번만 반환 (생성 시에만)
    ctx.body = await logSuccess(ctx, 'application_create', 'Application created successfully', application)
  } catch (e) {
    ctx.body = await logFailure(ctx, 'application_create', 'Application creation failed', e)
  }
})

/**
 * 애플리케이션 단일 조회
 */
route.get('/:id', async (ctx) => {
  try {
    const id = parseInt(ctx.params.id)

    if (!id) {
      return ctx.throw(400, 'Invalid application ID')
    }
    const companyId = requireServiceCompanyScope(ctx.request.profile, 'view applications')

    const application = await findScopedApplicationById(id, companyId)

    if (!application) {
      return ctx.throw(404, 'Application not found')
    }

    // Client Secret은 제외하고 반환 (상세 조회 시에는 제외)
    const { clientSecret: _clientSecret, allowedCountries: _allowedCountries, ...safeApp } = application
    const appData = { ...safeApp }

    // logSuccess가 이미 { result, data: responseBody }로 감싸므로 payload만 전달 (이중 래핑 방지)
    ctx.body = await logSuccess(ctx, 'application_get', 'Application retrieved successfully', appData)
  } catch (e) {
    ctx.body = await logFailure(ctx, 'application_get', 'Application retrieval failed', e)
  }
})

/**
 * 애플리케이션 수정
 */
route.put('/:id', async (ctx) => {
  try {
    const id = parseInt(ctx.params.id)
    const body = ctx.request.body

    if (!id) {
      return ctx.throw(400, 'Invalid application ID')
    }
    const companyId = requireServiceCompanyScope(ctx.request.profile, 'update applications')

    // 애플리케이션 존재 확인
    const existingApp = await findScopedApplicationById(id, companyId)

    if (!existingApp) {
      return ctx.throw(404, 'Application not found')
    }

    // 업데이트할 데이터 준비
    const updateData = {
      companyId: existingApp.companyId || companyId,
      updatedAt: new Date()
    }

    if (body.name !== undefined) updateData.name = body.name
    if (body.callback_url !== undefined) updateData.callbackUrl = body.callback_url
    if (body.is_active !== undefined) updateData.isActive = body.is_active
    if (body.login_identifier !== undefined) updateData.loginIdentifier = body.login_identifier
    if (body.auth_request_expiry !== undefined) updateData.authRequestExpiry = body.auth_request_expiry
    if (body.duplicate_request_limit !== undefined) updateData.duplicateRequestLimit = body.duplicate_request_limit
    // 애플리케이션 업데이트
    const updatedApp = await sql.db
      .update(sql.schema.sysApplication)
      .set(updateData)
      .where(and(
        eq(sql.schema.sysApplication.id, id),
        getApplicationCompanyScopeCondition(companyId)
      ))
      .returning()
      .get()

    const { clientSecret: _clientSecret, allowedCountries: _allowedCountries, ...safeApp } = updatedApp
    const appData = { ...safeApp }

    await syncRuntimeApp(updatedApp)

    ctx.body = await logSuccess(ctx, 'application_update', 'Application updated successfully', appData)
  } catch (e) {
    ctx.body = await logFailure(ctx, 'application_update', 'Application update failed', e)
  }
})

/**
 * Client Secret 재발급
 */
route.post('/:id/regenerate-secret', async (ctx) => {
  try {
    const id = parseInt(ctx.params.id)

    if (!id) {
      return ctx.throw(400, 'Invalid application ID')
    }
    const companyId = requireServiceCompanyScope(ctx.request.profile, 'regenerate client secret')

    // 애플리케이션 존재 확인
    const existingApp = await findScopedApplicationById(id, companyId)

    if (!existingApp) {
      return ctx.throw(404, 'Application not found')
    }

    // 새로운 Client Secret 생성
    const newSecret = generateClientSecret()

    // 업데이트
    await sql.db
      .update(sql.schema.sysApplication)
      .set({
        clientSecret: newSecret,
        companyId: existingApp.companyId || companyId,
        updatedAt: new Date()
      })
      .where(and(
        eq(sql.schema.sysApplication.id, id),
        getApplicationCompanyScopeCondition(companyId)
      ))

    // 업데이트 후 최신 데이터 조회 (returning()이 제대로 작동하지 않을 수 있으므로)
    const updatedApp = await findScopedApplicationById(id, companyId)

    if (!updatedApp) {
      return ctx.throw(404, 'Application not found after update')
    }

    await syncRuntimeApp(updatedApp)

    // logSuccess는 responseBody를 data에 넣으므로, updatedApp을 직접 전달
    ctx.body = await logSuccess(ctx, 'application_regenerate_secret', 'Client secret regenerated successfully', updatedApp)
  } catch (e) {
    ctx.body = await logFailure(ctx, 'application_regenerate_secret', 'Client secret regeneration failed', e)
  }
})

/**
 * 애플리케이션 삭제
 */
route.delete('/:id', async (ctx) => {
  try {
    const id = parseInt(ctx.params.id)

    if (!id) {
      return ctx.throw(400, 'Invalid application ID')
    }
    const companyId = requireServiceCompanyScope(ctx.request.profile, 'delete applications')

    // 애플리케이션 존재 확인
    const existingApp = await findScopedApplicationById(id, companyId)

    if (!existingApp) {
      return ctx.throw(404, 'Application not found')
    }

    // Soft delete
    await sql.db
      .update(sql.schema.sysApplication)
      .set({
        companyId: existingApp.companyId || companyId,
        isDel: true,
        updatedAt: new Date()
      })
      .where(and(
        eq(sql.schema.sysApplication.id, id),
        getApplicationCompanyScopeCondition(companyId)
      ))

    await syncRuntimeApp({ ...existingApp, isDel: true, isActive: false })

    ctx.body = await logSuccess(ctx, 'application_delete', 'Application deleted successfully', {})
  } catch (e) {
    ctx.body = await logFailure(ctx, 'application_delete', 'Application deletion failed', e)
  }
})

/**
 * 권한 범위 내 sys_application 목록 조회
 */
const fetchScopedSysApps = async (profile, appIdFilter) => {
  const companyId = requireServiceCompanyScope(profile, 'view application stats')
  const scopeCondition = getApplicationCompanyScopeCondition(companyId)
  const conditions = [
    eq(sql.schema.sysApplication.isDel, false),
    scopeCondition
  ]
  if (appIdFilter) {
    conditions.push(eq(sql.schema.sysApplication.id, appIdFilter))
  }
  return sql.db
    .select()
    .from(sql.schema.sysApplication)
    .where(and(...conditions))
    .all()
}

/**
 * sys_application 목록을 응답용 페이로드로 직렬화
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
 * 빈 통계 응답 생성
 */
const buildEmptyStats = (sysApps) => ({
  total_requests: 0,
  approved_count: 0,
  denied_count: 0,
  expired_count: 0,
  pending_count: 0,
  success_rate: 0,
  registered_apps_count: sysApps.length,
  registered_apps: serializeSysApps(sysApps)
})

/**
 * sys_application의 client_id 목록으로 app_sys_apps의 id 배열 반환
 */
const fetchAppIdsForClientIds = async (clientIds, companyId) => {
  if (clientIds.length === 0) return []
  const conditions = [_or(...clientIds.map((cid) => eq(sql.schema.apps.clientId, cid)))]
  if (companyId) {
    conditions.push(eq(sql.schema.apps.orgId, companyId))
  }
  const appRows = await sql.db
    .select()
    .from(sql.schema.apps)
    .where(and(...conditions))
    .all()
  return appRows.map((a) => a.id)
}

/**
 * 인증 요청 상태별 집계 결과 → 카운트 객체로 변환
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
 * 인증 요청 상태별 카운트 조회
 */
const fetchStatusCounts = async (appIds, query) => {
  const conditions = [_or(...appIds.map((aid) => eq(sql.schema.authRequests.appId, aid)))]
  if (query.start_date) {
    const startTs = new Date(query.start_date).getTime()
    conditions.push(sql.sql`${sql.schema.authRequests.createdAt} >= ${startTs}`)
  }
  if (query.end_date) {
    const endTs = new Date(query.end_date).getTime() + 86400000
    conditions.push(sql.sql`${sql.schema.authRequests.createdAt} <= ${endTs}`)
  }
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
 * 애플리케이션 통계 조회
 * 총 요청 횟수, 승인 횟수, 거절 횟수, 성공율, 등록된 페이지(앱) 목록
 *
 * Query params (선택):
 *   - app_id: 특정 sys_application id로 필터링 (없으면 권한 범위 내 전체 집계)
 *   - start_date / end_date: 기간 필터 (YYYY-MM-DD)
 */
route.get('/stats/summary', async (ctx) => {
  try {
    const profile = ctx.request.profile
    const query = ctx.request.query || {}
    const appIdFilter = query.app_id ? Number.parseInt(query.app_id, 10) : null
    const companyId = requireServiceCompanyScope(profile, 'view application stats')

    const sysApps = await fetchScopedSysApps(profile, appIdFilter)
    if (sysApps.length === 0) {
      ctx.body = await logSuccess(ctx, 'application_stats_summary', 'Application stats retrieved', buildEmptyStats(sysApps))
      return
    }

    const clientIds = sysApps.map((a) => a.clientId).filter(Boolean)
    const appIds = await fetchAppIdsForClientIds(clientIds, companyId)
    if (appIds.length === 0) {
      ctx.body = await logSuccess(ctx, 'application_stats_summary', 'Application stats retrieved', buildEmptyStats(sysApps))
      return
    }

    const statusCounts = await fetchStatusCounts(appIds, query)
    const counts = aggregateStatusCounts(statusCounts)

    // 성공율 = 승인 / (승인 + 거절) * 100, 분모 0이면 0
    const decided = counts.approved + counts.denied
    const successRate = decided > 0 ? Math.round((counts.approved / decided) * 10000) / 100 : 0

    ctx.body = await logSuccess(ctx, 'application_stats_summary', 'Application stats retrieved', {
      total_requests: counts.total,
      approved_count: counts.approved,
      denied_count: counts.denied,
      expired_count: counts.expired,
      pending_count: counts.pending,
      success_rate: successRate,
      registered_apps_count: sysApps.length,
      registered_apps: serializeSysApps(sysApps)
    })
  } catch (e) {
    ctx.body = await logFailure(ctx, 'application_stats_summary', 'Application stats retrieval failed', e)
  }
})

export default { prefix: '/sys_application', route }
