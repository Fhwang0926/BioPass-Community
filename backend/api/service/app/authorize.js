'use strict'

import { eq, and } from 'drizzle-orm'
import { randomBytesHex } from '../../../lib/forge.js'
import { sql } from '../../../lib/index.js'
import { logSuccess, logFailure } from '../../../service/audit.js'
import {
  evaluateSecurityPolicies,
  getRequestCountry,
  getRequestIp,
  recordBlockedSecurityPolicyRequest,
  recordSecurityPolicyRisks,
  securityPolicyErrorBody
} from '../../../service/securityPolicy.js'
import { recordAuthEvent } from '../../../service/transition.js'

export function register(route) {
  route.get('/authorize', async (ctx) => {
    try {
      const { client_id, redirect_uri, response_type, scope, state } = ctx.request.query

      if (!client_id) {
        ctx.status = 400
        ctx.body = { error: 'invalid_request', error_description: 'client_id 파라미터가 필요합니다.' }
        return
      }
      if (!redirect_uri) {
        ctx.status = 400
        ctx.body = { error: 'invalid_request', error_description: 'redirect_uri 파라미터가 필요합니다.' }
        return
      }
      if (response_type !== 'code') {
        ctx.status = 400
        ctx.body = { error: 'unsupported_response_type', error_description: 'response_type은 "code"만 지원됩니다.' }
        return
      }

      const application = await sql.db
        .select()
        .from(sql.schema.sysApplication)
        .where(and(
          eq(sql.schema.sysApplication.clientId, client_id),
          eq(sql.schema.sysApplication.isDel, false)
        ))
        .limit(1)
        .get()

      if (!application) {
        ctx.status = 400
        ctx.body = { error: 'invalid_client', error_description: '유효하지 않은 client_id입니다.' }
        return
      }
      if (!application.isActive) {
        ctx.status = 400
        ctx.body = { error: 'invalid_client', error_description: '비활성화된 애플리케이션입니다.' }
        return
      }
      if (redirect_uri !== application.callbackUrl) {
        ctx.status = 400
        ctx.body = { error: 'invalid_request', error_description: 'redirect_uri가 애플리케이션에 등록된 URL과 일치하지 않습니다.' }
        return
      }

      const requestId = `req_${Date.now()}_${randomBytesHex(8)}`
      const expiresAt = Date.now() + ((application.authRequestExpiry || 180) * 1000)
      const requestIp = getRequestIp(ctx)
      const userAgent = ctx.request.headers['user-agent'] || 'unknown'
      const country = getRequestCountry(ctx)

      let appRow = await sql.db
        .select()
        .from(sql.schema.apps)
        .where(eq(sql.schema.apps.clientId, client_id))
        .limit(1)
        .get()
      if (!appRow) {
        const appIdText = `app_${Date.now()}_${randomBytesHex(8)}`
        await sql.db
          .insert(sql.schema.apps)
          .values({
            id: appIdText,
            orgId: application.companyId || 1,
            name: application.name,
            clientId: application.clientId,
            clientSecret: application.clientSecret,
            redirectUri: application.callbackUrl || redirect_uri || '',
            status: 'ACTIVE',
            createdAt: Date.now()
          })
        appRow = { id: appIdText }
      }

      const PLACEHOLDER_USER_ID = '0'
      const placeholderUser = await sql.db
        .select()
        .from(sql.schema.users)
        .where(eq(sql.schema.users.id, PLACEHOLDER_USER_ID))
        .limit(1)
        .get()
      if (!placeholderUser) {
        await sql.db
          .insert(sql.schema.users)
          .values({
            id: PLACEHOLDER_USER_ID,
            identifierType: 'email',
            identifierHash: '__pending__',
            status: 'PENDING',
            createdAt: Date.now()
          })
      }

      const authRequestData = {
        id: requestId,
        appId: appRow.id,
        userId: PLACEHOLDER_USER_ID,
        status: 'CREATED',
        requestIp,
        userAgent,
        country,
        expiresAt,
        createdAt: Date.now()
      }

      const policyResult = await evaluateSecurityPolicies({ application, authRequestData })
      if (!policyResult.allowed) {
        await recordBlockedSecurityPolicyRequest({
          authRequestData,
          violations: policyResult.violations
        })
        ctx.status = 429
        ctx.body = securityPolicyErrorBody(policyResult)
        return
      }

      try {
        await sql.db
          .insert(sql.schema.authRequests)
          .values(authRequestData)

        await recordSecurityPolicyRisks({
          authRequestId: requestId,
          userId: authRequestData.userId,
          riskEvents: policyResult.riskEvents
        }).catch((err) => {
          console.warn('[app] security risk event record failed (non-fatal):', err?.message)
        })

        await sql.db
          .update(sql.schema.sysApplication)
          .set({ lastAuthRequestAt: new Date(), updatedAt: new Date() })
          .where(eq(sql.schema.sysApplication.id, application.id))
          .catch((err) => { console.warn('[app] lastAuthRequestAt update failed (non-fatal):', err?.message) })

        await recordAuthEvent({ authRequestId: requestId, eventType: 'CREATED', metadata: {} }).catch((err) => {
          console.warn('[app] CREATED event record failed (non-fatal):', err?.message)
        })

        const authPageUrl = `${ctx.request.protocol}://${ctx.request.host}/auth/login?request_id=${requestId}&redirect_uri=${encodeURIComponent(redirect_uri)}&state=${state ? encodeURIComponent(state) : ''}&scope=${scope ? encodeURIComponent(scope) : ''}`

        if (ctx.request.headers.accept && ctx.request.headers.accept.includes('application/json')) {
          ctx.body = await logSuccess(ctx, 'authorize_request', 'Authorization request created', {
            result: true,
            request_id: requestId,
            auth_url: authPageUrl,
            expires_at: expiresAt
          })
        } else {
          ctx.redirect(authPageUrl)
        }
      } catch (dbError) {
        console.error('Auth request creation error:', dbError)
        ctx.status = 500
        ctx.body = { error: 'server_error', error_description: '인증 요청 생성 중 오류가 발생했습니다.' }
      }
    } catch (e) {
      ctx.body = await logFailure(ctx, 'authorize_request', 'Authorization request failed', e)
    }
  })
}
