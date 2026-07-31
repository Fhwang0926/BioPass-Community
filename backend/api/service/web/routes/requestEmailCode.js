'use strict'

import { eq, and } from 'drizzle-orm'
import config from '../../../../config.js'
import { randomBytesHex } from '../../../../lib/forge.js'
import { sql, smtp } from '../../../../lib/index.js'
import { logSuccess } from '../../../../service/audit.js'
import { requestAuthNotification } from '../../../../service/notification.js'
import {
  evaluateSecurityPolicies,
  getRequestCountry,
  getRequestIp,
  recordBlockedSecurityPolicyRequest,
  recordSecurityPolicyRisks
} from '../../../../service/securityPolicy.js'
import { AuthRequestStatus } from '../../../../service/stateMachine.js'
import { transitionAuthRequest, recordAuthEvent } from '../../../../service/transition.js'
import { WEB_AUTH_FROM } from '../constants.js'
import { hasRegisteredPushDevice } from '../device.js'
import { authMailHtml, authMailSubject, getAuthText, resolveAuthLocale } from '../i18n.js'
import { renderErrorPage, renderGuidePage, getServerInfo } from '../render.js'
import {
  buildVerifyEmailUrl,
  resolvePublicBaseUrl,
  resolveRequestBaseUrl,
  normalizeIdentifier,
  isValidEmailForSending,
  generateVerificationCode
} from '../utils.js'
import {
  PLACEHOLDER_APP_USER_ID,
  ensurePlaceholderAppUser,
  findAppUserByIdentifier
} from '../../appUserIdentity.js'

export function register(route) {
  route.post('/request-email-code', async (ctx) => {
    try {
      const body = ctx.request.body || {}
      const client_id = (body.client_id != null && String(body.client_id).trim()) ? String(body.client_id).trim() : ''
      const redirect_uri = (body.redirect_uri != null && String(body.redirect_uri).trim()) ? String(body.redirect_uri).trim() : ''
      const state = (body.state != null && String(body.state).trim()) ? String(body.state).trim() : ''
      const scope = (body.scope != null && String(body.scope).trim()) ? String(body.scope).trim() : 'email,phone'
      const emailRaw = (body.email != null && String(body.email).trim()) ? String(body.email).trim() : ''
      const authLocale = resolveAuthLocale(ctx)
      const text = getAuthText(authLocale)

      const baseUrl = resolvePublicBaseUrl(ctx)

      const defaultEmailAuthParams = { clientId: client_id, redirectUri: redirect_uri, state, scope, locale: authLocale }
      const sendError = (status, error, errorDescription, serverInfo = null, emailAuthParams = defaultEmailAuthParams) => {
        ctx.status = status
        if (ctx.request.headers.accept && ctx.request.headers.accept.includes('text/html')) {
          ctx.type = 'text/html'
          ctx.body = renderErrorPage(status, error, errorDescription, baseUrl, serverInfo, emailAuthParams)
        } else {
          ctx.body = { error, error_description: errorDescription }
        }
      }

      if (!client_id) {
        sendError(400, 'invalid_request', text.clientIdRequired)
        return
      }
      if (!redirect_uri) {
        sendError(400, 'invalid_request', text.redirectUriRequired)
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
        sendError(400, 'invalid_client', text.invalidClient)
        return
      }
      if (!application.isActive) {
        sendError(400, 'invalid_client', text.inactiveClient)
        return
      }
      if (redirect_uri !== application.callbackUrl) {
        sendError(
          400,
          'invalid_request',
          text.redirectUriMismatch,
          getServerInfo(application, application.callbackUrl, authLocale),
          {
            clientId: client_id,
            redirectUri: application.callbackUrl,
            state,
            scope,
            locale: authLocale
          }
        )
        return
      }

      const _scope = scope.split(',').map(s => s.trim())
      if (_scope.includes('email') && application.loginIdentifier !== 'email' && application.loginIdentifier !== 'both') {
        sendError(400, 'invalid_request', text.emailUnsupported)
        return
      }

      const normalizedEmail = normalizeIdentifier('email', emailRaw)
      if (!normalizedEmail) {
        sendError(400, 'invalid_request', text.emailRequired)
        return
      }
      if (!isValidEmailForSending(normalizedEmail)) {
        sendError(400, 'invalid_request', text.invalidEmailForAuth)
        return
      }

      const requestId = `req_${Date.now()}_${randomBytesHex(8)}`
      const expiresAt = Date.now() + ((application.authRequestExpiry || 180) * 1000)
      const requestIp = getRequestIp(ctx)
      const userAgent = ctx.request.headers['user-agent'] || 'unknown'
      const country = getRequestCountry(ctx)

      const existingByEmail = await findAppUserByIdentifier('email', normalizedEmail)
      if (!existingByEmail) {
        await ensurePlaceholderAppUser()
      }
      const userIdForRequest = existingByEmail?.id || PLACEHOLDER_APP_USER_ID

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

      const authRequestData = {
        id: requestId,
        appId: appRow.id,
        userId: userIdForRequest,
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
        sendError(429, 'security_policy_blocked', policyResult.violations[0]?.message || text.securityPolicyBlocked)
        return
      }

      await sql.db
        .insert(sql.schema.authRequests)
        .values(authRequestData)

      await recordSecurityPolicyRisks({
        authRequestId: requestId,
        userId: authRequestData.userId,
        riskEvents: policyResult.riskEvents
      }).catch((err) => {
        console.warn('[web] security risk event record failed (non-fatal):', err?.message)
      })

      await recordAuthEvent({ authRequestId: requestId, eventType: 'CREATED', metadata: {} }).catch((err) => {
        console.warn('[web] CREATED event record failed (non-fatal):', err?.message)
      })

      if (existingByEmail && await hasRegisteredPushDevice(sql, userIdForRequest)) {
        await transitionAuthRequest({
          authRequestId: requestId,
          newStatus: AuthRequestStatus.PENDING,
          metadata: { source: 'email_device_notification', email: normalizedEmail }
        }).catch((err) => {
          console.warn('[web] CREATED→PENDING transition failed (non-fatal):', err?.message)
        })
        await requestAuthNotification(requestId).catch((err) => {
          console.warn('[web] auth notification failed (non-fatal):', err?.message)
        })

        if (ctx.request.headers.accept && ctx.request.headers.accept.includes('application/json')) {
          ctx.body = await logSuccess(ctx, 'request_email_code', 'Authorization notification sent', {
            result: true,
            request_id: requestId,
            auth_mode: 'connected_app',
            notification_sent: true,
            expires_at: expiresAt
          })
        } else {
          ctx.status = 200
          ctx.type = 'text/html'
          ctx.body = renderGuidePage(ctx, getServerInfo(application, redirect_uri, authLocale), {
            authRequestId: requestId,
            authMode: 'connected_app',
            authLocale,
            emailAuthClientId: client_id,
            emailAuthRedirectUri: redirect_uri,
            emailAuthState: state,
            emailAuthScope: scope
          })
        }
        return
      }

      await sql.db
        .update(sql.schema.logMail)
        .set({ isClear: true, updatedAt: new Date() })
        .where(and(
          eq(sql.schema.logMail.from, WEB_AUTH_FROM),
          eq(sql.schema.logMail.to, normalizedEmail),
          eq(sql.schema.logMail.isClear, false)
        ))
      const code = generateVerificationCode()
      const codeNum = parseInt(code, 10)
      const mailLog = await sql.db
        .insert(sql.schema.logMail)
        .values({
          from: WEB_AUTH_FROM,
          to: normalizedEmail,
          title: authMailSubject(authLocale),
          content: requestId,
          isHtml: false,
          isDone: false,
          isClear: false,
          uuid: codeNum,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning()
        .get()
      const verifyEmailUrl = buildVerifyEmailUrl(baseUrl, {
        requestId,
        email: normalizedEmail,
        redirectUri: redirect_uri,
        state,
        appName: application.name || '',
        locale: authLocale
      })
      const verifyEmailRedirectUrl = buildVerifyEmailUrl(resolveRequestBaseUrl(ctx), {
        requestId,
        email: normalizedEmail,
        redirectUri: redirect_uri,
        state,
        appName: application.name || '',
        locale: authLocale
      })
      let sent = false
      let errorMsg = null
      try {
        if (smtp && typeof smtp.send === 'function') {
          await smtp.send({
            to: normalizedEmail,
            subject: authMailSubject(authLocale),
            html: authMailHtml(authLocale, code, verifyEmailUrl)
          })
          sent = true
        }
      } catch (mailErr) {
        console.error('[web] Email verification send error:', mailErr)
        errorMsg = mailErr?.message || 'Email send failed'
      }
      if (mailLog?.id) {
        await sql.db
          .update(sql.schema.logMail)
          .set({
            isDone: sent || config.debug,
            sentAt: sent ? new Date() : null,
            errorMsg: errorMsg,
            updatedAt: new Date()
          })
          .where(eq(sql.schema.logMail.id, mailLog.id))
      }
      if (!sent && config.debug) {
        console.log('[web] Email verification code (dev only):', code, 'for', normalizedEmail)
      }
      await transitionAuthRequest({
        authRequestId: requestId,
        newStatus: AuthRequestStatus.PENDING,
        metadata: { source: 'email_code_sent', email: normalizedEmail }
      }).catch((err) => {
        console.warn('[web] CREATED→PENDING transition failed (non-fatal):', err?.message)
      })

      if (ctx.request.headers.accept && ctx.request.headers.accept.includes('application/json')) {
        ctx.body = await logSuccess(ctx, 'request_email_code', 'Email verification sent', {
          result: true,
          request_id: requestId,
          verify_url: verifyEmailUrl,
          expires_at: expiresAt
        })
      } else {
        ctx.redirect(verifyEmailRedirectUrl)
      }
    } catch (e) {
      console.error('Request email code error:', e)
      const baseUrl = resolvePublicBaseUrl(ctx)
      if (ctx.request.headers.accept && ctx.request.headers.accept.includes('text/html')) {
        ctx.status = 500
        ctx.type = 'text/html'
        const authLocale = resolveAuthLocale(ctx)
        const text = getAuthText(authLocale)
        ctx.body = renderErrorPage(500, 'server_error', text.requestEmailServerError + ' ' + (e?.message || ''), baseUrl, null, { locale: authLocale })
      } else {
        ctx.status = 500
        const authLocale = resolveAuthLocale(ctx)
        const text = getAuthText(authLocale)
        ctx.body = { error: 'server_error', error_description: text.requestEmailServerError }
      }
    }
  })
}
