'use strict'

import { and, desc, eq, gte, inArray, isNull, or, sql as drizzleSql } from 'drizzle-orm'
import { randomBytesHex } from '../lib/forge.js'
import { sql } from '../lib/index.js'
import { recordAuthEvent } from './transition.js'

export const SECURITY_POLICY_DEFAULTS = {
  IP_MULTIPLE: {
    enabled: true,
    threshold: 5,
    windowSeconds: 60
  },
  FAIL_LIMIT: {
    enabled: true,
    threshold: 3,
    windowSeconds: 300
  },
  PUSH_BOMB: {
    enabled: true,
    threshold: 10,
    windowSeconds: 60
  },
  COUNTRY_ALLOWLIST: {
    enabled: false,
    threshold: null,
    windowSeconds: null,
    allowedCountries: []
  },
  COUNTRY_CHANGE: {
    enabled: true,
    threshold: null,
    windowSeconds: null
  },
  NEW_DEVICE: {
    enabled: true,
    threshold: null,
    windowSeconds: null
  },
  MULTIPLE_REQUESTS: {
    enabled: true,
    threshold: 5,
    windowSeconds: 10
  }
}

export const SECURITY_POLICY_TYPES = Object.keys(SECURITY_POLICY_DEFAULTS)

const BLOCKING_POLICY_TYPES = new Set(['IP_MULTIPLE', 'FAIL_LIMIT', 'PUSH_BOMB'])
const PLACEHOLDER_USER_ID = '0'

export function isSupportedSecurityPolicyType(policyType) {
  return SECURITY_POLICY_TYPES.includes(policyType)
}

function toNullableInteger(value) {
  if (value === undefined || value === null || value === '') return null
  const num = Number(value)
  if (!Number.isFinite(num)) return null
  return Math.max(0, Math.trunc(num))
}

function toCompanyId(value) {
  const num = toNullableInteger(value)
  return num && num > 0 ? num : null
}

function toBoolean(value, fallback = true) {
  if (value === undefined || value === null || value === '') return fallback
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (['false', '0', 'off', 'no'].includes(normalized)) return false
    if (['true', '1', 'on', 'yes'].includes(normalized)) return true
  }
  return Boolean(value)
}

function normalizeCountryList(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || '').trim().toUpperCase())
      .filter(Boolean)
  }
  if (typeof value !== 'string') return []

  const trimmed = value.trim()
  if (!trimmed) return []

  try {
    const parsed = JSON.parse(trimmed)
    if (Array.isArray(parsed)) return normalizeCountryList(parsed)
  } catch {
    // Fall through to comma-separated parsing for legacy/manual values.
  }

  return trimmed
    .split(',')
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean)
}

export function normalizeSecurityPolicyPayload(body = {}) {
  const policyType = String(body.policy_type || body.policyType || '').trim().toUpperCase()
  const defaults = SECURITY_POLICY_DEFAULTS[policyType] || {}

  return {
    policyType,
    threshold: toNullableInteger(body.threshold) ?? defaults.threshold ?? null,
    windowSeconds: toNullableInteger(body.window_seconds ?? body.windowSeconds) ?? defaults.windowSeconds ?? null,
    allowedCountries: normalizeCountryList(body.allowed_countries ?? body.allowedCountries ?? defaults.allowedCountries),
    enabled: toBoolean(body.enabled, defaults.enabled !== false)
  }
}

function policyIsEnabled(policy) {
  return policy?.enabled === true || policy?.enabled === 1 || policy?.enabled === '1'
}

function policyNumber(policy, field) {
  const defaults = SECURITY_POLICY_DEFAULTS[policy.policyType] || {}
  const value = toNullableInteger(policy[field])
  return value ?? defaults[field] ?? null
}

function policyLimit(policy) {
  const threshold = policyNumber(policy, 'threshold')
  const windowSeconds = policyNumber(policy, 'windowSeconds')
  if (!threshold || !windowSeconds) return null
  return { threshold, windowSeconds, since: Date.now() - windowSeconds * 1000 }
}

function policyCountries(policy) {
  return normalizeCountryList(policy.allowedCountries ?? policy.allowed_countries)
}

function firstHeaderValue(value) {
  if (Array.isArray(value)) return firstHeaderValue(value[0])
  if (typeof value !== 'string') return value
  return value.split(',')[0].trim()
}

function normalizeIp(value) {
  return String(value || '').trim().replace(/^::ffff:/, '')
}

function isLoopbackIp(value) {
  const ip = normalizeIp(value).toLowerCase()
  return ip === 'localhost' || ip === '127.0.0.1' || ip === '::1'
}

function isLocalhostUrl(value) {
  if (!value || typeof value !== 'string') return false
  try {
    const hostname = new URL(value).hostname.toLowerCase()
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
  } catch {
    return false
  }
}

function isDevelopmentAuthRequest({ application, requestIp }) {
  return isLoopbackIp(requestIp) || isLocalhostUrl(application?.callbackUrl)
}

export function getRequestIp(ctx) {
  return firstHeaderValue(
    ctx.request.headers['x-forwarded-for'] ||
    ctx.request.headers['x-real-ip'] ||
    ctx.request.ip
  ) || 'unknown'
}

export function getRequestCountry(ctx) {
  const country = firstHeaderValue(
    ctx.request.headers['cf-ipcountry'] ||
    ctx.request.headers['x-vercel-ip-country'] ||
    ctx.request.headers['x-country-code']
  )
  return country && String(country).length <= 10 ? String(country).toUpperCase() : null
}

async function resolveSecurityPolicyCompanyId({ applicationId = null, companyId = null } = {}) {
  const scopedCompanyId = toCompanyId(companyId)
  if (scopedCompanyId) return scopedCompanyId

  const parsedApplicationId = toCompanyId(applicationId)
  if (!parsedApplicationId) return null

  const app = await sql.db
    .select({ companyId: sql.schema.sysApplication.companyId })
    .from(sql.schema.sysApplication)
    .where(eq(sql.schema.sysApplication.id, parsedApplicationId))
    .limit(1)
    .get()

  return toCompanyId(app?.companyId)
}

async function ensureCompanySecurityPolicies(companyId) {
  if (!companyId) return

  const rows = await sql.db
    .select({
      policyType: sql.schema.securityPolicies.policyType
    })
    .from(sql.schema.securityPolicies)
    .where(and(
      eq(sql.schema.securityPolicies.companyId, companyId),
      isNull(sql.schema.securityPolicies.appId)
    ))
    .all()

  const existingTypes = new Set(rows.map((row) => row.policyType))
  const missingTypes = SECURITY_POLICY_TYPES.filter((policyType) => !existingTypes.has(policyType))

  if (!missingTypes.length) return

  const now = Date.now()
  await sql.db
    .insert(sql.schema.securityPolicies)
    .values(missingTypes.map((policyType, index) => {
      const defaults = SECURITY_POLICY_DEFAULTS[policyType]
      return {
        id: `policy_${now}_${index}_${randomBytesHex(6)}`,
        scope: 'COMPANY',
        companyId,
        appId: null,
        policyType,
        threshold: defaults.threshold,
        windowSeconds: defaults.windowSeconds,
        allowedCountries: defaults.allowedCountries ? JSON.stringify(defaults.allowedCountries) : null,
        enabled: defaults.enabled,
        createdAt: now
      }
    }))
}

export async function getEffectiveSecurityPolicies({ applicationId = null, companyId = null } = {}) {
  const scopedCompanyId = await resolveSecurityPolicyCompanyId({ applicationId, companyId })
  if (!scopedCompanyId) return []

  await ensureCompanySecurityPolicies(scopedCompanyId)

  const parsedApplicationId = toCompanyId(applicationId)
  const where = parsedApplicationId
    ? and(
      eq(sql.schema.securityPolicies.companyId, scopedCompanyId),
      or(isNull(sql.schema.securityPolicies.appId), eq(sql.schema.securityPolicies.appId, parsedApplicationId))
    )
    : and(
      eq(sql.schema.securityPolicies.companyId, scopedCompanyId),
      isNull(sql.schema.securityPolicies.appId)
    )

  const rows = await sql.db
    .select()
    .from(sql.schema.securityPolicies)
    .where(where)
    .all()

  const byType = new Map()
  for (const row of rows.filter((policy) => policy.appId === null || policy.appId === undefined)) {
    byType.set(row.policyType, row)
  }
  if (applicationId) {
    for (const row of rows.filter((policy) => policy.appId === parsedApplicationId)) {
      byType.set(row.policyType, row)
    }
  }

  return SECURITY_POLICY_TYPES
    .map((policyType) => byType.get(policyType))
    .filter(Boolean)
}

function countWhere(conditions) {
  return and(...conditions.filter(Boolean))
}

async function countAuthRequests(conditions) {
  const row = await sql.db
    .select({ count: drizzleSql`count(*)::int` })
    .from(sql.schema.authRequests)
    .where(countWhere(conditions))
    .get()
  return Number(row?.count ?? 0)
}

async function latestPriorCountry({ appId, userId }) {
  if (!userId || userId === PLACEHOLDER_USER_ID) return null
  return sql.db
    .select({ country: sql.schema.authRequests.country })
    .from(sql.schema.authRequests)
    .where(and(
      eq(sql.schema.authRequests.appId, appId),
      eq(sql.schema.authRequests.userId, userId),
      drizzleSql`${sql.schema.authRequests.country} is not null`
    ))
    .orderBy(desc(sql.schema.authRequests.createdAt))
    .limit(1)
    .get()
}

function violation(policy, count, limit, message) {
  return {
    policyId: policy.id,
    policyType: policy.policyType,
    count,
    threshold: limit.threshold,
    windowSeconds: limit.windowSeconds,
    message
  }
}

function risk(policy, riskType, score, action, reason) {
  return {
    policyId: policy.id,
    policyType: policy.policyType,
    riskType,
    score,
    action,
    reason
  }
}

export async function evaluateSecurityPolicies({ application, authRequestData }) {
  const policies = await getEffectiveSecurityPolicies({
    applicationId: application?.id ?? null,
    companyId: application?.companyId ?? null
  })
  const enabledPolicies = policies.filter(policyIsEnabled)
  const violations = []
  const riskEvents = []

  const appId = authRequestData.appId
  const userId = authRequestData.userId
  const hasKnownUser = userId && userId !== PLACEHOLDER_USER_ID
  const requestIp = authRequestData.requestIp || 'unknown'
  const userAgent = authRequestData.userAgent || 'unknown'
  const country = authRequestData.country || null
  const isDevelopmentRequest = isDevelopmentAuthRequest({ application, requestIp })

  for (const policy of enabledPolicies) {
    if (BLOCKING_POLICY_TYPES.has(policy.policyType)) {
      const limit = policyLimit(policy)
      if (!limit) continue

      if (policy.policyType === 'IP_MULTIPLE') {
        const count = await countAuthRequests([
          eq(sql.schema.authRequests.appId, appId),
          eq(sql.schema.authRequests.requestIp, requestIp),
          gte(sql.schema.authRequests.createdAt, limit.since)
        ])
        if (count >= limit.threshold) {
          violations.push(violation(policy, count, limit, `동일 IP에서 ${limit.windowSeconds}초 동안 ${limit.threshold}건을 초과했습니다.`))
        }
      }

      if (policy.policyType === 'FAIL_LIMIT') {
        const identityCondition = hasKnownUser
          ? eq(sql.schema.authRequests.userId, userId)
          : eq(sql.schema.authRequests.requestIp, requestIp)
        const count = await countAuthRequests([
          eq(sql.schema.authRequests.appId, appId),
          identityCondition,
          inArray(sql.schema.authRequests.status, ['DENIED']),
          gte(sql.schema.authRequests.createdAt, limit.since)
        ])
        if (count >= limit.threshold) {
          violations.push(violation(policy, count, limit, `승인 실패가 ${limit.windowSeconds}초 동안 ${limit.threshold}건을 초과했습니다.`))
        }
      }

      if (policy.policyType === 'PUSH_BOMB') {
        const identityCondition = hasKnownUser
          ? eq(sql.schema.authRequests.userId, userId)
          : eq(sql.schema.authRequests.requestIp, requestIp)
        const count = await countAuthRequests([
          eq(sql.schema.authRequests.appId, appId),
          identityCondition,
          gte(sql.schema.authRequests.createdAt, limit.since)
        ])
        if (count >= limit.threshold) {
          violations.push(violation(policy, count, limit, `푸시 알림 대상 요청이 ${limit.windowSeconds}초 동안 ${limit.threshold}건을 초과했습니다.`))
        }
      }
    }

    if (policy.policyType === 'COUNTRY_CHANGE' && hasKnownUser && country) {
      const previous = await latestPriorCountry({ appId, userId })
      if (previous?.country && previous.country !== country) {
        riskEvents.push(risk(policy, 'COUNTRY_CHANGE', 70, 'REQUIRE_REAUTH', `접속 국가가 ${previous.country}에서 ${country}(으)로 변경되었습니다.`))
      }
    }

    if (policy.policyType === 'COUNTRY_ALLOWLIST') {
      if (isDevelopmentRequest) continue
      const allowedCountries = policyCountries(policy)
      if (allowedCountries.length > 0 && (!country || !allowedCountries.includes(country))) {
        violations.push({
          policyId: policy.id,
          policyType: policy.policyType,
          count: 1,
          threshold: allowedCountries.length,
          windowSeconds: null,
          message: country
            ? `${country} 국가는 현재 보안 정책에서 허용되지 않습니다.`
            : '요청 국가를 확인할 수 없어 보안 정책에 의해 차단되었습니다.'
        })
      }
    }

    if (policy.policyType === 'NEW_DEVICE' && hasKnownUser && userAgent !== 'unknown') {
      const previousCount = await countAuthRequests([
        eq(sql.schema.authRequests.appId, appId),
        eq(sql.schema.authRequests.userId, userId)
      ])
      const sameDeviceCount = await countAuthRequests([
        eq(sql.schema.authRequests.appId, appId),
        eq(sql.schema.authRequests.userId, userId),
        eq(sql.schema.authRequests.userAgent, userAgent)
      ])
      if (previousCount > 0 && sameDeviceCount === 0) {
        riskEvents.push(risk(policy, 'NEW_DEVICE', 65, 'REQUIRE_REAUTH', '이전에 사용하지 않은 브라우저/디바이스에서 요청되었습니다.'))
      }
    }

    if (policy.policyType === 'MULTIPLE_REQUESTS') {
      const limit = policyLimit(policy)
      if (!limit) continue
      const identityCondition = hasKnownUser
        ? eq(sql.schema.authRequests.userId, userId)
        : eq(sql.schema.authRequests.requestIp, requestIp)
      const count = await countAuthRequests([
        eq(sql.schema.authRequests.appId, appId),
        identityCondition,
        gte(sql.schema.authRequests.createdAt, limit.since)
      ])
      if (count >= limit.threshold) {
        riskEvents.push(risk(policy, 'MULTIPLE_REQUESTS', 60, 'REQUIRE_REAUTH', `짧은 시간 다중 요청이 감지되었습니다. (${count}건)`))
      }
    }
  }

  return {
    allowed: violations.length === 0,
    violations,
    riskEvents
  }
}

export async function recordSecurityPolicyRisks({ authRequestId, userId, riskEvents = [] }) {
  if (!riskEvents.length) return

  const now = Date.now()
  await sql.db
    .insert(sql.schema.riskEvents)
    .values(riskEvents.map((event, index) => ({
      id: `risk_${now}_${index}_${randomBytesHex(6)}`,
      authRequestId,
      userId,
      riskType: event.riskType || event.policyType,
      score: event.score ?? 0,
      action: event.action || 'ALLOW',
      createdAt: now
    })))
}

export async function recordBlockedSecurityPolicyRequest({ authRequestData, violations = [] }) {
  await sql.db
    .insert(sql.schema.authRequests)
    .values({
      ...authRequestData,
      status: 'BLOCKED'
    })

  await recordAuthEvent({
    authRequestId: authRequestData.id,
    eventType: 'BLOCKED',
    metadata: {
      reason: 'security_policy',
      violations
    }
  }).catch((err) => {
    console.warn('[security-policy] BLOCKED event record failed (non-fatal):', err?.message)
  })

  await recordSecurityPolicyRisks({
    authRequestId: authRequestData.id,
    userId: authRequestData.userId,
    riskEvents: violations.map((item) => ({
      policyType: item.policyType,
      riskType: item.policyType,
      score: 100,
      action: 'BLOCK',
      reason: item.message
    }))
  }).catch((err) => {
    console.warn('[security-policy] blocked risk event record failed (non-fatal):', err?.message)
  })
}

export function securityPolicyErrorBody(policyResult) {
  const first = policyResult?.violations?.[0]
  return {
    error: 'security_policy_blocked',
    code: 'SECURITY_POLICY_BLOCKED',
    policy_type: first?.policyType || null,
    message: first?.message || '보안 정책에 의해 인증 요청이 차단되었습니다.'
  }
}
