'use strict'

import { eq, and, inArray, desc } from 'drizzle-orm'
import { randomBytesHex } from '../../../../lib/forge.js'
import { sql } from '../../../../lib/index.js'
import { logSuccess, logFailure } from '../../../../service/audit.js'
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
import {
  hasRegisteredDevice,
  hasRegisteredPushDevice,
  findUserWithPushDeviceByEmail
} from '../device.js'
import { WEB_AUTH_FROM } from '../constants.js'
import { getAuthText, resolveAuthLocale } from '../i18n.js'
import { renderErrorPage, renderGuidePage, getServerInfo } from '../render.js'
import {
  resolvePublicBaseUrl,
  buildVerifyEmailUrl,
  hashCode,
  normalizeIdentifier,
  isValidEmailForSending
} from '../utils.js'
import {
  PLACEHOLDER_APP_USER_ID,
  ensurePlaceholderAppUser,
  findAppUserByIdentifier
} from '../../appUserIdentity.js'

async function findOpenEmailRequestFromMailLog(appId, email) {
  if (!appId || !email) return null

  const mailRows = await sql.db
    .select({ requestId: sql.schema.logMail.content })
    .from(sql.schema.logMail)
    .where(and(
      eq(sql.schema.logMail.from, WEB_AUTH_FROM),
      eq(sql.schema.logMail.to, email),
      eq(sql.schema.logMail.isClear, false)
    ))
    .orderBy(desc(sql.schema.logMail.createdAt))
    .limit(10)
    .all()

  for (const mailRow of mailRows) {
    if (!mailRow?.requestId) continue
    const authRequest = await sql.db
      .select({
        id: sql.schema.authRequests.id,
        status: sql.schema.authRequests.status,
        expiresAt: sql.schema.authRequests.expiresAt
      })
      .from(sql.schema.authRequests)
      .where(and(
        eq(sql.schema.authRequests.id, mailRow.requestId),
        eq(sql.schema.authRequests.appId, appId),
        inArray(sql.schema.authRequests.status, ['PENDING', 'CREATED'])
      ))
      .limit(1)
      .get()
    if (authRequest && Number(authRequest.expiresAt) > Date.now()) {
      return authRequest
    }
  }

  return null
}

export function register(route) {
  route.get('/authorize', async (ctx) => {
    try {
      const { client_id, redirect_uri, response_type, scope, state, email, phone, phone_origin } = ctx.request.query

      const acceptsHtml = ctx.request.headers.accept && ctx.request.headers.accept.includes('text/html')
      const baseUrl = resolvePublicBaseUrl(ctx)
      const authLocale = resolveAuthLocale(ctx)
      const text = getAuthText(authLocale)

      const requestedScope = (scope && typeof scope === 'string' ? scope : '') || 'email,phone'
      const emailAuthParamsForError = (client_id && redirect_uri)
        ? { clientId: client_id, redirectUri: redirect_uri, state: state || '', scope: requestedScope, locale: authLocale }
        : null

      const sendError = (status, error, errorDescription, serverInfo = null, emailAuthParams = emailAuthParamsForError) => {
        ctx.status = status
        if (acceptsHtml) {
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

      if (response_type !== 'code') {
        sendError(400, 'unsupported_response_type', 'response_type은 "code"만 지원됩니다.')
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
        sendError(400, 'invalid_client', text.inactiveClient, getServerInfo(application, redirect_uri, authLocale))
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
            state: state || '',
            scope: requestedScope,
            locale: authLocale
          }
        )
        return
      }

      const _scope = scope.split(',').map(s => s.trim())
      if (_scope.includes('email') && application.loginIdentifier !== 'email' && application.loginIdentifier !== 'both') {
        sendError(400, 'invalid_request', text.emailUnsupported, getServerInfo(application, redirect_uri, authLocale))
        return
      }
      if (_scope.includes('phone') && application.loginIdentifier !== 'phone' && application.loginIdentifier !== 'both') {
        sendError(400, 'invalid_request', 'phone 인증을 지원하지 않는 애플리케이션입니다.', getServerInfo(application, redirect_uri))
        return
      }

      let requestId = `req_${Date.now()}_${randomBytesHex(8)}`
      let authRequestStatus = AuthRequestStatus.CREATED
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

      let userIdForRequest = PLACEHOLDER_APP_USER_ID
      let userResolvedByPhone = false

      const normalizedPhone = normalizeIdentifier('phone', phone || phone_origin)
      const normalizedEmail = normalizeIdentifier('email', email)
      if (normalizedPhone) {
        const phoneHash = hashCode(normalizedPhone)
        const existingByPhone = await sql.db
          .select({ id: sql.schema.users.id })
          .from(sql.schema.users)
          .where(and(
            eq(sql.schema.users.identifierType, 'phone'),
            eq(sql.schema.users.identifierHash, phoneHash)
          ))
          .limit(1)
          .get()
        if (existingByPhone) {
          userIdForRequest = existingByPhone.id
          userResolvedByPhone = true
        }
      }
      if (userIdForRequest === PLACEHOLDER_APP_USER_ID && normalizedEmail) {
        const existingByEmail = await findAppUserByIdentifier('email', normalizedEmail)
        if (existingByEmail) {
          userIdForRequest = existingByEmail.id
        }
      }

      if (userIdForRequest === PLACEHOLDER_APP_USER_ID) {
        await ensurePlaceholderAppUser()
      }

      const redirectUri = application.callbackUrl || redirect_uri
      let hadPhoneButNoDevices = false
      if (userResolvedByPhone) {
        const hasDevice = await hasRegisteredDevice(sql, userIdForRequest)
        if (!hasDevice) {
          userResolvedByPhone = false
          hadPhoneButNoDevices = true
        }
      }

      // 이메일만 있는 미가입 사용자는 placeholder 요청으로 시작하고, 코드 검증 성공 시 실제 app_users로 연결한다.
      const willUseAuthRequest = userResolvedByPhone || !!normalizedEmail
      if (willUseAuthRequest) {
        // 페이지 새로고침 시 중복 생성 방지: 동일 유저+앱의 만료 안 된 PENDING/CREATED 요청이 있으면 재사용
        const existingRequest = userIdForRequest === PLACEHOLDER_APP_USER_ID && normalizedEmail
          ? await findOpenEmailRequestFromMailLog(appRow.id, normalizedEmail)
          : await sql.db
            .select({
              id: sql.schema.authRequests.id,
              status: sql.schema.authRequests.status,
              expiresAt: sql.schema.authRequests.expiresAt
            })
            .from(sql.schema.authRequests)
            .where(and(
              eq(sql.schema.authRequests.userId, userIdForRequest),
              eq(sql.schema.authRequests.appId, appRow.id),
              inArray(sql.schema.authRequests.status, ['PENDING', 'CREATED'])
            ))
            .limit(1)
            .get()

        console.log('[authorize] dedup check:', { existingRequest, now: Date.now(), userId: userIdForRequest, appId: appRow.id })
        if (existingRequest && Number(existingRequest.expiresAt) > Date.now()) {
          console.log('[authorize] reusing existing request:', existingRequest.id)
          requestId = existingRequest.id
          authRequestStatus = existingRequest.status || AuthRequestStatus.CREATED
        } else {
          console.log('[authorize] creating new request:', requestId)
          const authRequestData = {
            id: requestId,
            appId: appRow.id,
            userId: userIdForRequest,
            status: AuthRequestStatus.CREATED,
            requestIp: requestIp,
            userAgent: userAgent,
            country,
            expiresAt: expiresAt,
            createdAt: Date.now()
          }
          const policyResult = await evaluateSecurityPolicies({ application, authRequestData })
          if (!policyResult.allowed) {
            await recordBlockedSecurityPolicyRequest({
              authRequestData,
              violations: policyResult.violations
            })
            sendError(429, 'security_policy_blocked', policyResult.violations[0]?.message || text.securityPolicyBlocked, getServerInfo(application, redirect_uri, authLocale))
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

          await sql.db
            .update(sql.schema.sysApplication)
            .set({ lastAuthRequestAt: new Date(), updatedAt: new Date() })
            .where(eq(sql.schema.sysApplication.id, application.id))
            .catch((err) => { console.warn('[web] lastAuthRequestAt update failed (non-fatal):', err?.message) })

          await recordAuthEvent({ authRequestId: requestId, eventType: 'CREATED', metadata: {} })
            .catch((err) => { console.warn('[web] CREATED event record failed (non-fatal):', err?.message) })
          authRequestStatus = AuthRequestStatus.CREATED
        }
      }

      try {
        if (userResolvedByPhone) {
          await transitionAuthRequest({
            authRequestId: requestId,
            newStatus: AuthRequestStatus.PENDING,
            metadata: { source: 'authorize' }
          }).catch((err) => {
            console.warn('[web] CREATED→PENDING transition failed (non-fatal):', err?.message)
          })
          const authPageUrl = `${redirectUri}?request_id=${requestId}&redirect_uri=${encodeURIComponent(redirect_uri)}&state=${state ? encodeURIComponent(state) : ''}&scope=${scope ? encodeURIComponent(scope) : ''}`
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
        } else if (normalizedEmail) {
          if (!isValidEmailForSending(normalizedEmail)) {
            sendError(400, 'invalid_request', text.invalidEmailForAuth, getServerInfo(application, redirect_uri, authLocale))
            return
          }
          // 등록된 기기 여부 확인 (push 버튼 노출 여부 결정용)
          let emailUserHasDevice = userIdForRequest !== PLACEHOLDER_APP_USER_ID && await hasRegisteredPushDevice(sql, userIdForRequest)
          if (!emailUserHasDevice) {
            const byEmail = await findUserWithPushDeviceByEmail(sql, normalizedEmail)
            if (byEmail.found) {
              emailUserHasDevice = true
              userIdForRequest = byEmail.userId
              await sql.db
                .update(sql.schema.authRequests)
                .set({ userId: userIdForRequest })
                .where(eq(sql.schema.authRequests.id, requestId))
                .catch((err) => { console.warn('[web] auth request user update failed (non-fatal):', err?.message) })
            }
          }
          let autoNotificationSent = false
          let autoNotificationFailed = false
          if (emailUserHasDevice && authRequestStatus === AuthRequestStatus.CREATED) {
            const transitionResult = await transitionAuthRequest({
              authRequestId: requestId,
              newStatus: AuthRequestStatus.PENDING,
              metadata: { source: 'authorize_auto_push', email: normalizedEmail }
            })
            if (transitionResult.success) {
              authRequestStatus = AuthRequestStatus.PENDING
              const notificationResult = await requestAuthNotification(requestId)
                .catch((err) => {
                  console.warn('[web] auth notification failed (non-fatal):', err?.message)
                  return { sent: false, allFailed: true, noTokens: false }
                })
              autoNotificationSent = Boolean(notificationResult?.sent && !notificationResult?.allFailed)
              autoNotificationFailed = Boolean(notificationResult?.allFailed || notificationResult?.noTokens)
              if (autoNotificationSent) {
                await recordAuthEvent({
                  authRequestId: requestId,
                  eventType: 'PUSH_SENT',
                  metadata: { source: 'authorize_auto_push', email: normalizedEmail }
                }).catch((err) => {
                  console.warn('[web] PUSH_SENT event record failed (non-fatal):', err?.message)
                })
              }
            } else {
              console.warn('[web] auto push transition skipped:', transitionResult.error)
            }
          }
          // 등록된 push 기기가 없으면 앱 알림 선택 화면 대신 이메일 코드 인증으로 바로 이동
          if (!emailUserHasDevice) {
            const verifyEmailParams = {
              requestId,
              email: normalizedEmail,
              redirectUri: redirect_uri,
              state: state || '',
              appName: application.name || '',
              locale: authLocale
            }
            const verifyEmailUrl = buildVerifyEmailUrl(baseUrl, verifyEmailParams)

            if (ctx.request.headers.accept?.includes('application/json')) {
              ctx.body = await logSuccess(ctx, 'authorize_request', 'Email verification required', {
                result: true,
                request_id: requestId,
                auth_mode: 'email_code',
                has_push_device: false,
                verify_url: verifyEmailUrl,
                expires_at: expiresAt
              })
              return
            }
            ctx.redirect(verifyEmailUrl)
            return
          }

          if (ctx.request.headers.accept?.includes('application/json')) {
            ctx.body = await logSuccess(ctx, 'authorize_request', 'Auth choice ready', {
              result: true,
              request_id: requestId,
              auth_mode: 'choice',
              has_push_device: true,
              notification_sent: autoNotificationSent,
              notification_failed: autoNotificationFailed,
              expires_at: expiresAt
            })
            return
          }
          ctx.status = 200
          ctx.type = 'text/html'
          ctx.body = renderGuidePage(ctx, getServerInfo(application, redirect_uri, authLocale), {
            authRequestId: requestId,
            authMode: 'choice',
            authLocale,
            hasPushDevice: true,
            autoNotificationSent,
            autoNotificationFailed,
            choiceEmail: normalizedEmail,
            emailAuthClientId: client_id,
            emailAuthRedirectUri: redirect_uri,
            emailAuthState: state || '',
            emailAuthScope: scope
          })
        } else {
          if (acceptsHtml) {
            ctx.status = 200
            ctx.type = 'text/html'
            ctx.body = renderGuidePage(ctx, getServerInfo(application, redirect_uri, authLocale), {
              showNoAppHint: hadPhoneButNoDevices,
              authRequestId: willUseAuthRequest ? requestId : '',
              authMode: 'no_app',
              authLocale
            })
          } else {
            const errorMsg = hadPhoneButNoDevices
              ? '등록된 앱이 없습니다. 이메일을 입력해 주세요.'
              : '이메일 또는 전화번호가 필요합니다.'
            sendError(400, 'invalid_request', errorMsg)
          }
        }
      } catch (dbError) {
        console.error('Auth request creation error:', dbError)
        const acceptsHtml = ctx.request.headers.accept && ctx.request.headers.accept.includes('text/html')
        ctx.status = 500
        if (acceptsHtml) {
          ctx.type = 'text/html'
          const errorBaseUrl = resolvePublicBaseUrl(ctx)
          const serverInfo = application ? getServerInfo(application, redirect_uri) : null
          const emailAuthParams = {
            clientId: client_id,
            redirectUri: redirect_uri,
            state: state || '',
            scope: (scope && typeof scope === 'string' ? scope : '') || 'email,phone'
          }
          ctx.body = renderErrorPage(500, 'server_error', '인증 요청 생성 중 오류가 발생했습니다. ' + (dbError?.message || ''), errorBaseUrl, serverInfo, emailAuthParams)
        } else {
          ctx.body = {
            error: 'server_error',
            error_description: '인증 요청 생성 중 오류가 발생했습니다.'
          }
        }
      }
    } catch (e) {
      const acceptsHtml = ctx.request.headers.accept && ctx.request.headers.accept.includes('text/html')
      if (acceptsHtml) {
        ctx.status = 500
        ctx.type = 'text/html'
        const errorBaseUrl = resolvePublicBaseUrl(ctx)
        const q = ctx.request.query || {}
        const emailAuthParams = (q.client_id && q.redirect_uri) ? { clientId: q.client_id, redirectUri: q.redirect_uri, state: q.state || '', scope: (q.scope && typeof q.scope === 'string' ? q.scope : '') || 'email,phone' } : null
        ctx.body = renderErrorPage(500, 'server_error', (e?.message || 'Authorization request failed'), errorBaseUrl, null, emailAuthParams)
      } else {
        ctx.body = await logFailure(ctx, 'authorize_request', 'Authorization request failed', e)
      }
    }
  })
}
