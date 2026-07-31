'use strict'

import { eq, and } from 'drizzle-orm'
import config from '../../../../config.js'
import { sql, smtp } from '../../../../lib/index.js'
import { renderTemplate, escapeHtml } from '../../../../lib/template.js'
import { logSuccess, logFailure } from '../../../../service/audit.js'
import { requestAuthNotification } from '../../../../service/notification.js'
import { AuthRequestStatus } from '../../../../service/stateMachine.js'
import { createAuthCode, transitionAuthRequest } from '../../../../service/transition.js'
import { consumeRateLimit } from '../../../../lib/rateLimit.js'
import { WEB_AUTH_FROM } from '../constants.js'
import { hasRegisteredPushDevice, findUserWithPushDeviceByEmail } from '../device.js'
import {
  authMailHtml,
  authMailSubject,
  authTemplateVars,
  getAuthText,
  resolveAuthLocale
} from '../i18n.js'
import { renderErrorPage, renderGuidePage, getServerInfo } from '../render.js'
import {
  buildVerifyEmailUrl,
  resolvePublicBaseUrl,
  normalizeIdentifier,
  isValidEmailForSending,
  generateVerificationCode,
  getDeviceTypeFromUserAgent,
  getGuideImageUrl,
  renderAppDownloadButton
} from '../utils.js'
import { ensureWebAuthEmailUser } from '../../appUserIdentity.js'

/**
 * POST /verify-email 오류 시 이메일 폼 노출용 컨텍스트 조회
 * request_id로 client_id·application 조회 후 serverInfo, emailAuthParams 반환
 */
export async function _getVerifyEmailErrorContext(requestId, redirectUri, state) {
  if (!requestId || !redirectUri || typeof redirectUri !== 'string') return { serverInfo: null, emailAuthParams: null }
  try {
    const authReq = await sql.db
      .select({ appId: sql.schema.authRequests.appId })
      .from(sql.schema.authRequests)
      .where(eq(sql.schema.authRequests.id, requestId))
      .limit(1)
      .get()
    if (!authReq) return { serverInfo: null, emailAuthParams: null }
    const appRow = await sql.db
      .select({ clientId: sql.schema.apps.clientId })
      .from(sql.schema.apps)
      .where(eq(sql.schema.apps.id, authReq.appId))
      .limit(1)
      .get()
    if (!appRow) return { serverInfo: null, emailAuthParams: null }
    const application = await sql.db
      .select()
      .from(sql.schema.sysApplication)
      .where(and(eq(sql.schema.sysApplication.clientId, appRow.clientId), eq(sql.schema.sysApplication.isDel, false)))
      .limit(1)
      .get()
    if (!application) return { serverInfo: null, emailAuthParams: null }
    const serverInfo = getServerInfo(application, redirectUri)
    const emailAuthParams = {
      clientId: appRow.clientId,
      redirectUri: redirectUri.trim(),
      state: (state != null && String(state).trim()) ? String(state).trim() : '',
      scope: 'email,phone'
    }
    return { serverInfo, emailAuthParams }
  } catch {
    return { serverInfo: null, emailAuthParams: null }
  }
}

async function ensureEmailCodeForRequest(requestId, email, authLocale = 'ko', verifyEmailUrl = '') {
  if (!requestId || !email || !isValidEmailForSending(email)) return { created: false, sent: false }
  const existingMail = await sql.db
    .select({ id: sql.schema.logMail.id })
    .from(sql.schema.logMail)
    .where(and(
      eq(sql.schema.logMail.from, WEB_AUTH_FROM),
      eq(sql.schema.logMail.to, email),
      eq(sql.schema.logMail.content, requestId),
      eq(sql.schema.logMail.isClear, false)
    ))
    .limit(1)
    .get()
  if (existingMail) return { created: false, sent: false }

  await sql.db
    .update(sql.schema.logMail)
    .set({ isClear: true, updatedAt: new Date() })
    .where(and(
      eq(sql.schema.logMail.from, WEB_AUTH_FROM),
      eq(sql.schema.logMail.to, email),
      eq(sql.schema.logMail.isClear, false)
    ))

  const code = generateVerificationCode()
  const mailLog = await sql.db
    .insert(sql.schema.logMail)
    .values({
      from: WEB_AUTH_FROM,
      to: email,
      title: authMailSubject(authLocale),
      content: requestId,
      isHtml: false,
      isDone: false,
      isClear: false,
      uuid: parseInt(code, 10),
      createdAt: new Date(),
      updatedAt: new Date()
    })
    .returning()
    .get()

  let sent = false
  let errorMsg = null
  try {
    if (smtp && typeof smtp.send === 'function') {
      await smtp.send({
        to: email,
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
        errorMsg,
        updatedAt: new Date()
      })
      .where(eq(sql.schema.logMail.id, mailLog.id))
  }
  if (!sent && config.debug) {
    console.log('[web] Email verification code (dev only):', code, 'for', email)
  }
  return { created: true, sent }
}

const emailCodeDeliveryInFlight = new Set()

function scheduleEmailCodeForRequest({ requestId, email, authLocale = 'ko', verifyEmailUrl = '', shouldTransitionToPending = false }) {
  if (!requestId || !email) return
  const deliveryKey = `${requestId}:${email}`
  if (emailCodeDeliveryInFlight.has(deliveryKey)) return

  emailCodeDeliveryInFlight.add(deliveryKey)
  setImmediate(() => {
    ensureEmailCodeForRequest(requestId, email, authLocale, verifyEmailUrl)
      .then(async () => {
        if (!shouldTransitionToPending) return
        await transitionAuthRequest({
          authRequestId: requestId,
          newStatus: AuthRequestStatus.PENDING,
          metadata: { source: 'verify_email_code_sent', email }
        }).catch((err) => {
          console.warn('[web] CREATED→PENDING transition failed (non-fatal):', err?.message)
        })
      })
      .catch((err) => {
        console.warn('[web] async email verification code delivery failed (non-fatal):', err?.message)
      })
      .finally(() => {
        emailCodeDeliveryInFlight.delete(deliveryKey)
      })
  })
}

function buildCallbackUrl(redirectUri, code, state = '') {
  if (!redirectUri || !code) return ''
  const sep = redirectUri.includes('?') ? '&' : '?'
  return redirectUri + sep + 'code=' + encodeURIComponent(code) + (state ? '&state=' + encodeURIComponent(state) : '')
}

/** Registered OAuth callback for an auth request (never trust client redirect_uri). */
async function resolveRegisteredRedirectUri(requestId) {
  if (!requestId) return null
  const authReq = await sql.db
    .select({ appId: sql.schema.authRequests.appId })
    .from(sql.schema.authRequests)
    .where(eq(sql.schema.authRequests.id, requestId))
    .limit(1)
    .get()
  if (!authReq?.appId) return null

  const appRow = await sql.db
    .select({
      clientId: sql.schema.apps.clientId,
      redirectUri: sql.schema.apps.redirectUri
    })
    .from(sql.schema.apps)
    .where(eq(sql.schema.apps.id, authReq.appId))
    .limit(1)
    .get()
  if (!appRow) return null

  const application = await sql.db
    .select({ callbackUrl: sql.schema.sysApplication.callbackUrl })
    .from(sql.schema.sysApplication)
    .where(and(
      eq(sql.schema.sysApplication.clientId, appRow.clientId),
      eq(sql.schema.sysApplication.isDel, false)
    ))
    .limit(1)
    .get()

  const registered = (application?.callbackUrl || appRow.redirectUri || '').trim()
  return registered || null
}

function assertRedirectUriMatch(provided, registered) {
  if (!registered) return false
  if (!provided) return true
  return String(provided).trim() === registered
}

export function register(route) {
  route.post('/auth-request-status', async (ctx) => {
    const body = ctx.request.body || {}
    const requestId = (body.request_id != null && String(body.request_id).trim()) ? String(body.request_id).trim() : ''
    const redirectUri = (body.redirect_uri != null && String(body.redirect_uri).trim()) ? String(body.redirect_uri).trim() : ''
    const state = (body.state != null && String(body.state).trim()) ? String(body.state).trim() : ''
    const authLocale = resolveAuthLocale(ctx)
    const text = getAuthText(authLocale)

    if (!requestId) {
      ctx.status = 400
      ctx.body = { error: 'invalid_request', error_description: text.missingRequestEmail }
      return
    }

    const authRequest = await sql.db
      .select({
        id: sql.schema.authRequests.id,
        status: sql.schema.authRequests.status,
        expiresAt: sql.schema.authRequests.expiresAt
      })
      .from(sql.schema.authRequests)
      .where(eq(sql.schema.authRequests.id, requestId))
      .limit(1)
      .get()

    if (!authRequest) {
      ctx.status = 404
      ctx.body = { error: 'not_found', error_description: text.authAlreadyProcessed }
      return
    }

    if (
      (authRequest.status === AuthRequestStatus.PENDING || authRequest.status === AuthRequestStatus.CREATED) &&
      authRequest.expiresAt &&
      Number(authRequest.expiresAt) < Date.now()
    ) {
      await transitionAuthRequest({
        authRequestId: requestId,
        newStatus: AuthRequestStatus.EXPIRED,
        metadata: { source: 'web_status_poll' }
      }).catch((err) => {
        console.warn('[web] status poll expire transition failed (non-fatal):', err?.message)
      })
      ctx.body = { status: AuthRequestStatus.EXPIRED, expired: true, error: 'expired', error_description: text.codeExpired }
      return
    }

    if (authRequest.status === AuthRequestStatus.APPROVED) {
      const registeredRedirect = await resolveRegisteredRedirectUri(requestId)
      if (!registeredRedirect) {
        ctx.status = 400
        ctx.body = { status: authRequest.status, error: 'invalid_request', error_description: text.redirectUriMissing }
        return
      }
      if (!assertRedirectUriMatch(redirectUri, registeredRedirect)) {
        ctx.status = 400
        ctx.body = {
          status: authRequest.status,
          error: 'invalid_request',
          error_description: text.redirectUriMismatch
        }
        return
      }

      const codeResult = await createAuthCode({ authRequestId: requestId, expiresInSeconds: 180 })
      if (!codeResult.success || !codeResult.code) {
        ctx.status = 500
        ctx.body = { status: authRequest.status, error: 'server_error', error_description: text.authCodeIssue }
        return
      }

      const callbackUrl = buildCallbackUrl(registeredRedirect, codeResult.code, state)
      await logSuccess(ctx, 'auth_request_status', 'App authentication completed', { request_id: requestId })
      ctx.body = {
        status: authRequest.status,
        approved: true,
        redirect_url: callbackUrl
      }
      return
    }

    if (authRequest.status === AuthRequestStatus.DENIED) {
      ctx.body = { status: authRequest.status, denied: true, error: 'denied', error_description: text.js.appDenied }
      return
    }

    if (authRequest.status === AuthRequestStatus.EXPIRED) {
      ctx.body = { status: authRequest.status, expired: true, error: 'expired', error_description: text.codeExpired }
      return
    }

    if (authRequest.status === AuthRequestStatus.CONSUMED) {
      ctx.body = { status: authRequest.status, consumed: true, error: 'consumed', error_description: text.authAlreadyProcessed }
      return
    }

    ctx.body = {
      status: authRequest.status,
      pending: authRequest.status === AuthRequestStatus.PENDING || authRequest.status === AuthRequestStatus.CREATED,
      expires_at: authRequest.expiresAt || null
    }
  })

  route.get('/verify-email', async (ctx) => {
    const { request_id, email, redirect_uri, state, app_name } = ctx.request.query
    const baseUrl = resolvePublicBaseUrl(ctx)
    const authLocale = resolveAuthLocale(ctx)
    const text = getAuthText(authLocale)
    const commonVars = authTemplateVars(authLocale, escapeHtml)
    if (!request_id || !email) {
      ctx.status = 400
      ctx.type = 'text/html'
      ctx.body = renderErrorPage(400, 'invalid_request', text.missingRequestEmail, baseUrl, null, { locale: authLocale })
      return
    }
    let serverInfo = null
    let authReq = null
    let emailAuthClientId = ''
    try {
      authReq = await sql.db
        .select({
          appId: sql.schema.authRequests.appId,
          userId: sql.schema.authRequests.userId,
          status: sql.schema.authRequests.status,
          expiresAt: sql.schema.authRequests.expiresAt
        })
        .from(sql.schema.authRequests)
        .where(eq(sql.schema.authRequests.id, request_id))
        .limit(1)
        .get()
      if (authReq) {
        const appRow = await sql.db
          .select({ clientId: sql.schema.apps.clientId })
          .from(sql.schema.apps)
          .where(eq(sql.schema.apps.id, authReq.appId))
          .limit(1)
          .get()
        if (appRow) {
          emailAuthClientId = appRow.clientId || ''
          const application = await sql.db
            .select({ name: sql.schema.sysApplication.name })
            .from(sql.schema.sysApplication)
            .where(eq(sql.schema.sysApplication.clientId, appRow.clientId))
            .limit(1)
            .get()
          if (application && redirect_uri) {
            serverInfo = getServerInfo(application, redirect_uri, authLocale)
          }
        }
      }
    } catch (_) { /* non-fatal */ }
    const redirectUriStr = redirect_uri == null ? '' : (Array.isArray(redirect_uri) ? redirect_uri[0] : redirect_uri)
    if (!serverInfo && redirectUriStr && typeof redirectUriStr === 'string') {
      const appNameFromQuery = (app_name != null && String(app_name).trim()) ? String(app_name).trim() : text.unknownApp
      serverInfo = getServerInfo({ name: appNameFromQuery }, redirectUriStr, authLocale)
    }
    const normalizedEmail = normalizeIdentifier('email', email)
    const appNameForLink = (app_name != null && String(app_name).trim())
      ? String(app_name).trim()
      : (serverInfo?.appName || '')
    const verifyEmailUrl = buildVerifyEmailUrl(baseUrl, {
      requestId: String(request_id),
      email: normalizedEmail,
      redirectUri: redirectUriStr,
      state: state || '',
      appName: appNameForLink,
      locale: authLocale
    })
    const isOpenAuthRequest = authReq &&
      (authReq.status === AuthRequestStatus.CREATED || authReq.status === AuthRequestStatus.PENDING) &&
      (!authReq.expiresAt || Number(authReq.expiresAt) > Date.now())
    if (normalizedEmail && isOpenAuthRequest) {
      let pushUserId = null
      if (await hasRegisteredPushDevice(sql, authReq.userId)) {
        pushUserId = authReq.userId
      } else {
        const byEmail = await findUserWithPushDeviceByEmail(sql, normalizedEmail)
        if (byEmail.found) pushUserId = byEmail.userId
      }

      if (pushUserId) {
        if (String(pushUserId) !== String(authReq.userId)) {
          await sql.db
            .update(sql.schema.authRequests)
            .set({ userId: pushUserId })
            .where(eq(sql.schema.authRequests.id, request_id))
            .catch((err) => {
              console.warn('[web] auth request user update failed (non-fatal):', err?.message)
            })
        }
        if (authReq.status === AuthRequestStatus.CREATED) {
          await transitionAuthRequest({
            authRequestId: String(request_id),
            newStatus: AuthRequestStatus.PENDING,
            metadata: { source: 'verify_email_with_device', email: normalizedEmail }
          }).catch((err) => {
            console.warn('[web] CREATED→PENDING transition failed (non-fatal):', err?.message)
          })
        }
        await requestAuthNotification(String(request_id)).catch((err) => {
          console.warn('[web] auth notification failed (non-fatal):', err?.message)
        })
        ctx.status = 200
        ctx.type = 'text/html'
        ctx.body = renderGuidePage(ctx, serverInfo, {
          authRequestId: String(request_id),
          authMode: 'connected_app',
          authLocale,
          emailAuthClientId,
          emailAuthRedirectUri: redirectUriStr,
          emailAuthState: state || '',
          emailAuthScope: 'email'
        })
        return
      }

      scheduleEmailCodeForRequest({
        requestId: String(request_id),
        email: normalizedEmail,
        authLocale,
        verifyEmailUrl,
        shouldTransitionToPending: authReq.status === AuthRequestStatus.CREATED
      })
    }
    const serverSectionDisplay = serverInfo ? 'block' : 'none'
    const maskedEmail = String(email).replace(/^(.{2})(.*)(@.*)$/, (_, a, b, c) => a + '***' + c)
    ctx.type = 'text/html'
    ctx.body = renderTemplate('auth.html', {
      ...commonVars,
      errorSectionDisplay: 'none',
      pageHeroDisplay: 'none',
      status: '',
      error: '',
      errorDescription: '',
      serverSectionDisplay,
      serverAppName: serverInfo ? escapeHtml(serverInfo.appName) : '',
      serverSiteOrigin: serverInfo ? escapeHtml(serverInfo.siteOrigin) : '',
      serverHostname: serverInfo ? escapeHtml(serverInfo.hostname) : '',
      serverFaviconUrl: serverInfo && serverInfo.faviconUrl ? escapeHtml(serverInfo.faviconUrl) : '',
      serverCertificateLabel: serverInfo ? escapeHtml(serverInfo.certificateLabel) : '',
      serverCertificateStatus: serverInfo ? serverInfo.certificateStatus : '',
      serverPhishingLabel: serverInfo ? escapeHtml(serverInfo.phishingLabel) : '',
      serverPhishingStatus: serverInfo ? serverInfo.phishingStatus : 'safe',
      appDownloadAndroidButton: renderAppDownloadButton('android', authLocale),
      appDownloadIosButton: renderAppDownloadButton('ios', authLocale),
      guideStep1Image: escapeHtml(getGuideImageUrl(baseUrl, 1)),
      guideStep2Image: escapeHtml(getGuideImageUrl(baseUrl, 2)),
      guideStep3Image: escapeHtml(getGuideImageUrl(baseUrl, 3)),
      verifyEmailSectionDisplay: 'block',
      guideSectionDisplay: 'block',
      showGuideAppInstall: 'block',
      verifyEmailRequestId: escapeHtml(String(request_id)),
      verifyEmailEmail: escapeHtml(String(email)),
      verifyEmailRedirectUri: escapeHtml(String(redirect_uri || '')),
      verifyEmailState: escapeHtml(String(state || '')),
      verifyEmailMasked: escapeHtml(maskedEmail),
      noAppHintDisplay: 'none',
      bioAuthSectionHtml: '',
      authRequestId: '',
      deepLinkScheme: '',
      deepLinkPath: '',
      androidPackage: '',
      bioAuthSectionDisplay: 'none',
      authChoiceDividerDisplay: 'none',
      emailAuthSectionDisplay: 'none',
      emailAuthTitle: escapeHtml(text.emailAuthFallbackTitle),
      emailAuthDescription: escapeHtml(text.emailAuthFallbackDescription),
      emailAuthAppInstallDisplay: 'none',
      emailAuthRequestCodeUrl: '',
      emailAuthClientId: '',
      emailAuthRedirectUri: '',
      emailAuthState: '',
      emailAuthScope: '',
      guideStep1: escapeHtml(text.guideNoApp1),
      guideStep2: escapeHtml(text.guideNoApp2),
      guideStep3: escapeHtml(text.guideNoApp3),
      authChoiceSectionDisplay: 'none',
      authChoicePushDisplay: 'none',
      authChoiceEmail: '',
      authChoiceEmailMasked: '',
      authChoiceDescription: '',
      authChoiceInitialToast: '',
      authChoiceInitialToastClass: 'bio-auth-toast',
      authChoiceTitle: escapeHtml(text.authChoiceTitle || ''),
      authChoicePushButton: escapeHtml(text.authChoicePushButton || ''),
      authChoiceEmailButton: escapeHtml(text.authChoiceEmailButton || '')
    })
  })

  route.post('/verify-email', async (ctx) => {
    const baseUrl = resolvePublicBaseUrl(ctx)
    const body = ctx.request.body || {}
    const requestId = body.request_id
    const email = normalizeIdentifier('email', body.email)
    const code = (body.code || '').trim()
    const redirectUriFromBody = (body.redirect_uri != null && String(body.redirect_uri).trim()) ? String(body.redirect_uri).trim() : ''
    const stateFromBody = (body.state != null && String(body.state).trim()) ? String(body.state).trim() : ''
    const authLocale = resolveAuthLocale(ctx)
    const text = getAuthText(authLocale)

    const acceptsJson = ctx.request.headers.accept && ctx.request.headers.accept.includes('application/json')

    const sendVerifyError = async (status, error, errorDescription, logReason = null) => {
      await logFailure(ctx, 'verify_email_code', logReason || errorDescription, { error, error_description: errorDescription, email, request_id: requestId })

      ctx.status = status
      if (acceptsJson) {
        ctx.body = { error, error_description: errorDescription }
      } else {
        ctx.type = 'text/html'
        ctx.body = renderErrorPage(status, error, errorDescription, baseUrl, null, { locale: authLocale })
      }
    }

    if (!requestId || !email) {
      await sendVerifyError(400, 'invalid_request', text.missingRequestEmail, 'Missing request_id or email')
      return
    }
    if (!/^\d{6}$/.test(code)) {
      await sendVerifyError(400, 'invalid_request', text.js.codeRequired, 'Invalid code format')
      return
    }

    const verifyAttempt = consumeRateLimit({
      key: `verify-email:${requestId}:${email}`,
      limit: 5,
      windowMs: 15 * 60 * 1000
    })
    if (!verifyAttempt.allowed) {
      ctx.set('Retry-After', String(verifyAttempt.retryAfterSec))
      await sendVerifyError(429, 'too_many_requests', text.js?.tooManyAttempts || 'Too many verification attempts. Try again later.', 'Verify email rate limited')
      return
    }

    const codeNum = parseInt(code, 10)
    const logRow = await sql.db
      .select()
      .from(sql.schema.logMail)
      .where(and(
        eq(sql.schema.logMail.from, WEB_AUTH_FROM),
        eq(sql.schema.logMail.to, email),
        eq(sql.schema.logMail.uuid, codeNum),
        eq(sql.schema.logMail.isClear, false)
      ))
      .limit(1)
      .get()

    if (!logRow) {
      const alreadyUsedRow = await sql.db
        .select({ id: sql.schema.logMail.id })
        .from(sql.schema.logMail)
        .where(and(
          eq(sql.schema.logMail.from, WEB_AUTH_FROM),
          eq(sql.schema.logMail.to, email),
          eq(sql.schema.logMail.uuid, codeNum),
          eq(sql.schema.logMail.isClear, true),
          eq(sql.schema.logMail.content, requestId)
        ))
        .limit(1)
        .get()
      if (alreadyUsedRow) {
        await sendVerifyError(400, 'code_already_used', text.js.codeAlreadyUsed, 'Verification code already used')
      } else {
        await sendVerifyError(400, 'invalid_code', text.invalidCode, 'Invalid verification code')
      }
      return
    }
    if (logRow.content !== requestId) {
      await sendVerifyError(400, 'invalid_code', text.invalidCode, 'Invalid verification code')
      return
    }

    const authRequest = await sql.db
      .select()
      .from(sql.schema.authRequests)
      .where(eq(sql.schema.authRequests.id, requestId))
      .limit(1)
      .get()

    if (!authRequest || (authRequest.status !== AuthRequestStatus.PENDING && authRequest.status !== AuthRequestStatus.CREATED)) {
      await sendVerifyError(400, 'invalid_request', text.authAlreadyProcessed, 'Auth request not found or already processed')
      return
    }
    if (authRequest.expiresAt && authRequest.expiresAt < Date.now()) {
      await sendVerifyError(400, 'expired', text.codeExpired, 'Verification code expired')
      return
    }

    const verifiedUser = await ensureWebAuthEmailUser(email)
    if (!verifiedUser || verifiedUser.status === 'INACTIVE') {
      await sendVerifyError(400, 'invalid_grant', '사용자를 찾을 수 없거나 비활성화된 사용자입니다.', 'Verified email user unavailable')
      return
    }
    if (String(authRequest.userId) !== String(verifiedUser.id)) {
      await sql.db
        .update(sql.schema.authRequests)
        .set({ userId: verifiedUser.id })
        .where(eq(sql.schema.authRequests.id, requestId))
    }

    const userAgent = ctx.request.headers['user-agent'] || ''
    const deviceType = getDeviceTypeFromUserAgent(userAgent)
    const transitionResult = await transitionAuthRequest({
      authRequestId: requestId,
      newStatus: AuthRequestStatus.APPROVED,
      metadata: { source: 'verify_email', userAgent, deviceType }
    })
    if (!transitionResult.success) {
      await sendVerifyError(400, 'transition_failed', transitionResult.error || text.transitionFailed, 'Auth request transition failed')
      return
    }

    await sql.db
      .update(sql.schema.logMail)
      .set({ isClear: true, updatedAt: new Date() })
      .where(eq(sql.schema.logMail.id, logRow.id))

    const registeredRedirect = await resolveRegisteredRedirectUri(requestId)
    if (!registeredRedirect) {
      await sendVerifyError(400, 'invalid_request', text.redirectUriMissing, 'Missing registered redirect_uri')
      return
    }
    const providedRedirect = redirectUriFromBody || body.redirect_uri || ''
    if (!assertRedirectUriMatch(providedRedirect, registeredRedirect)) {
      await sendVerifyError(400, 'invalid_request', text.redirectUriMismatch, 'redirect_uri mismatch')
      return
    }

    const codeResult = await createAuthCode({ authRequestId: requestId, expiresInSeconds: 180 })
    if (!codeResult.success || !codeResult.code) {
      await sendVerifyError(500, 'server_error', text.authCodeIssue, 'Auth code creation failed')
      return
    }

    const state = stateFromBody || body.state || ''
    const callbackUrl = buildCallbackUrl(registeredRedirect, codeResult.code, state)
    await logSuccess(ctx, 'verify_email_code', 'Email verification successful', { email, request_id: requestId })

    if (acceptsJson) {
      ctx.body = { success: true, redirect_url: callbackUrl }
    } else {
      ctx.redirect(callbackUrl)
    }
  })
}
