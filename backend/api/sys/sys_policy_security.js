'use strict'

import { eq, and, or as _or, isNull } from 'drizzle-orm'
import Router from 'koa-router'
import { sql } from '../../lib/index.js'
import { logSuccess, logFailure } from '../../service/audit.js'
import {
  getEffectiveSecurityPolicies,
  isSupportedSecurityPolicyType,
  normalizeSecurityPolicyPayload
} from '../../service/securityPolicy.js'
import { requireServiceCompanyScope } from '../../service/serviceScope.js'

const route = new Router()
const LEGACY_DEFAULT_COMPANY_ID = 1

const resolveAppId = (body) => {
  if (body.app_id === undefined || body.app_id === null || body.app_id === '') {
    return null
  }
  const appId = parseInt(String(body.app_id), 10)
  return isNaN(appId) ? NaN : appId
}

const ensureCompanyApplication = async (appId, companyId) => {
  if (appId === null) return null

  const companyScopeCondition = companyId === LEGACY_DEFAULT_COMPANY_ID
    ? _or(
      eq(sql.schema.sysApplication.companyId, companyId),
      isNull(sql.schema.sysApplication.companyId)
    )
    : eq(sql.schema.sysApplication.companyId, companyId)

  return sql.db
    .select({ id: sql.schema.sysApplication.id })
    .from(sql.schema.sysApplication)
    .where(and(
      eq(sql.schema.sysApplication.id, appId),
      companyScopeCondition,
      eq(sql.schema.sysApplication.isDel, false)
    ))
    .limit(1)
    .get()
}

/**
 * 보안 정책 목록 조회
 * app_id 없으면 전역 정책만, 있으면 해당 앱 정책 포함 (일관된 목록 반환)
 */
route.post('/policies/search', async (ctx) => {
  try {
    const body = ctx.request.body || {}
    const companyId = requireServiceCompanyScope(ctx.request.profile, 'search security policies')
    const appId = resolveAppId(body)
    if (Number.isNaN(appId)) {
      return ctx.throw(400, 'Invalid app_id')
    }
    if (appId !== null) {
      const app = await ensureCompanyApplication(appId, companyId)
      if (!app) {
        return ctx.throw(404, 'Application not found')
      }
    }

    const policies = await getEffectiveSecurityPolicies({
      applicationId: appId,
      companyId
    })

    ctx.body = await logSuccess(ctx, 'policy_search', 'Policy search successful', policies)
  } catch (e) {
    ctx.body = await logFailure(ctx, 'policy_search', 'Policy search failed', e)
  }
})

/**
 * 보안 정책 생성/수정
 */
route.post('/policies', async (ctx) => {
  try {
    const body = ctx.request.body || {}

    const companyId = requireServiceCompanyScope(ctx.request.profile, 'manage security policies')

    const normalized = normalizeSecurityPolicyPayload(body)

    if (!normalized.policyType) {
      return ctx.throw(400, 'Policy type is required')
    }
    if (!isSupportedSecurityPolicyType(normalized.policyType)) {
      return ctx.throw(400, 'Unsupported policy type')
    }

    const appIdInt = resolveAppId(body)
    if (Number.isNaN(appIdInt)) {
      return ctx.throw(400, 'Invalid app_id')
    }
    if (appIdInt !== null) {
      const app = await ensureCompanyApplication(appIdInt, companyId)
      if (!app) {
        return ctx.throw(404, 'Application not found')
      }
    }

    // 기존 정책 확인
    const existing = await sql.db
      .select()
      .from(sql.schema.securityPolicies)
      .where(and(
        eq(sql.schema.securityPolicies.companyId, companyId),
        eq(sql.schema.securityPolicies.policyType, normalized.policyType),
        appIdInt !== null ? eq(sql.schema.securityPolicies.appId, appIdInt) : isNull(sql.schema.securityPolicies.appId)
      ))
      .limit(1)
      .get()

    const policyData = {
      id: existing?.id || `policy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      scope: appIdInt !== null ? 'APP' : 'COMPANY',
      companyId,
      appId: appIdInt,
      policyType: normalized.policyType,
      threshold: normalized.threshold,
      windowSeconds: normalized.windowSeconds,
      allowedCountries: normalized.allowedCountries?.length ? JSON.stringify(normalized.allowedCountries) : null,
      enabled: normalized.enabled,
      createdAt: existing?.createdAt || Date.now()
    }

    let savedPolicy
    if (existing) {
      // 업데이트
      await sql.db
        .update(sql.schema.securityPolicies)
        .set({
          threshold: policyData.threshold,
          windowSeconds: policyData.windowSeconds,
          allowedCountries: policyData.allowedCountries,
          enabled: policyData.enabled
        })
        .where(eq(sql.schema.securityPolicies.id, existing.id))

      // 업데이트 후 실제 DB에서 조회
      savedPolicy = await sql.db
        .select()
        .from(sql.schema.securityPolicies)
        .where(eq(sql.schema.securityPolicies.id, existing.id))
        .get()
    } else {
      // 생성
      await sql.db
        .insert(sql.schema.securityPolicies)
        .values(policyData)

      // 생성 후 실제 DB에서 조회
      savedPolicy = await sql.db
        .select()
        .from(sql.schema.securityPolicies)
        .where(eq(sql.schema.securityPolicies.id, policyData.id))
        .get()
    }

    ctx.body = await logSuccess(ctx, 'policy_save', 'Policy saved successfully', savedPolicy || policyData)
  } catch (e) {
    const msg = e?.message || ''
    const outOfRange = msg.includes('out of range') && msg.includes('integer')
    if (outOfRange) {
      ctx.body = await logFailure(
        ctx,
        'policy_save',
        'Policy save failed: created_at exceeds integer range. Restart the API so schema sync can run (or: npm run db:push).',
        e
      )
      return
    }
    ctx.body = await logFailure(ctx, 'policy_save', 'Policy save failed', e)
  }
})

export default { prefix: '/sys_policy_security', route }
