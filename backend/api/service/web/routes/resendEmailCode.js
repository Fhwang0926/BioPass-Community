'use strict'

import { eq, and, or, desc } from 'drizzle-orm'
import config from '../../../../config.js'
import { randomBytesHex } from '../../../../lib/forge.js'
import { sql, smtp } from '../../../../lib/index.js'
import { AuthRequestStatus } from '../../../../service/stateMachine.js'
import { transitionAuthRequest, recordAuthEvent } from '../../../../service/transition.js'
import { WEB_AUTH_FROM } from '../constants.js'
import { authMailHtml, authMailSubject, getAuthText, resolveAuthLocale } from '../i18n.js'
import {
  buildVerifyEmailUrl,
  resolvePublicBaseUrl,
  normalizeIdentifier,
  isValidEmailForSending,
  generateVerificationCode
} from '../utils.js'
import {
  PLACEHOLDER_APP_USER_ID,
  ensurePlaceholderAppUser,
  findAppUserByIdentifier
} from '../../appUserIdentity.js'

async function findOpenRequestById(requestId) {
  if (!requestId) return null
  return sql.db
    .select()
    .from(sql.schema.authRequests)
    .where(and(
      eq(sql.schema.authRequests.id, requestId),
      or(
        eq(sql.schema.authRequests.status, AuthRequestStatus.PENDING),
        eq(sql.schema.authRequests.status, AuthRequestStatus.CREATED)
      )
    ))
    .limit(1)
    .get()
}

async function hasEmailCodeForRequest(requestId, email) {
  if (!requestId || !email) return false
  const mailRow = await sql.db
    .select({ id: sql.schema.logMail.id })
    .from(sql.schema.logMail)
    .where(and(
      eq(sql.schema.logMail.from, WEB_AUTH_FROM),
      eq(sql.schema.logMail.to, email),
      eq(sql.schema.logMail.content, requestId)
    ))
    .limit(1)
    .get()
  return Boolean(mailRow)
}

async function findOpenRequestFromMailLog(email) {
  if (!email) return null
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
    const authRequest = await findOpenRequestById(mailRow?.requestId)
    if (authRequest) return authRequest
  }
  return null
}

export function register(route) {
  route.post('/resend-email-code', async (ctx) => {
    try {
      const body = ctx.request.body || {}
      const emailRaw = (body.email != null && String(body.email).trim()) ? String(body.email).trim() : ''
      const redirect_uri = (body.redirect_uri != null && String(body.redirect_uri).trim()) ? String(body.redirect_uri).trim() : ''
      const _state = (body.state != null && String(body.state).trim()) ? String(body.state).trim() : ''
      const request_id = (body.request_id != null && String(body.request_id).trim()) ? String(body.request_id).trim() : ''
      const authLocale = resolveAuthLocale(ctx)
      const text = getAuthText(authLocale)
      const baseUrl = resolvePublicBaseUrl(ctx)

      const normalizedEmail = normalizeIdentifier('email', emailRaw)
      if (!normalizedEmail) {
        ctx.status = 400
        ctx.body = { error: 'invalid_request', error_description: text.emailRequired }
        return
      }
      if (!isValidEmailForSending(normalizedEmail)) {
        ctx.status = 400
        ctx.body = { error: 'invalid_request', error_description: text.invalidEmailForAuth }
        return
      }

      const existingUser = await findAppUserByIdentifier('email', normalizedEmail)
      let existingRequest = request_id
        ? await findOpenRequestById(request_id)
        : null

      if (!existingRequest && existingUser) {
        existingRequest = await sql.db
          .select()
          .from(sql.schema.authRequests)
          .where(and(
            eq(sql.schema.authRequests.userId, existingUser.id),
            or(
              eq(sql.schema.authRequests.status, AuthRequestStatus.PENDING),
              eq(sql.schema.authRequests.status, AuthRequestStatus.CREATED)
            )
          ))
          .orderBy(desc(sql.schema.authRequests.createdAt))
          .limit(1)
          .get()
      }
      if (!existingRequest) {
        existingRequest = await findOpenRequestFromMailLog(normalizedEmail)
      }

      if (!existingRequest) {
        ctx.status = 400
        ctx.body = { error: 'invalid_request', error_description: text.resendMissingAuth }
        return
      }

      const requestBelongsToEmail = (existingUser && existingRequest.userId === existingUser.id) ||
        await hasEmailCodeForRequest(existingRequest.id, normalizedEmail)
      if (!requestBelongsToEmail) {
        ctx.status = 400
        ctx.body = { error: 'invalid_request', error_description: text.resendMissingAuth }
        return
      }

      const appId = existingRequest.appId
      const userIdForRequest = existingUser?.id || existingRequest.userId || PLACEHOLDER_APP_USER_ID
      if (userIdForRequest === PLACEHOLDER_APP_USER_ID) {
        await ensurePlaceholderAppUser()
      }
      let appName = ''

      await sql.db
        .update(sql.schema.authRequests)
        .set({ status: AuthRequestStatus.EXPIRED })
        .where(eq(sql.schema.authRequests.id, existingRequest.id))

      await recordAuthEvent({
        authRequestId: existingRequest.id,
        eventType: 'EXPIRED_BY_RESEND',
        metadata: { reason: 'resend' }
      }).catch(() => {})

      if (!appName) {
        const appRow = await sql.db
          .select({ name: sql.schema.apps.name })
          .from(sql.schema.apps)
          .where(eq(sql.schema.apps.id, appId))
          .limit(1)
          .get()
        appName = appRow?.name || ''
      }

      await sql.db
        .update(sql.schema.logMail)
        .set({ isClear: true, updatedAt: new Date() })
        .where(and(
          eq(sql.schema.logMail.from, WEB_AUTH_FROM),
          eq(sql.schema.logMail.to, normalizedEmail),
          eq(sql.schema.logMail.isClear, false)
        ))

      const requestId = `req_${Date.now()}_${randomBytesHex(8)}`
      const expiresAt = Date.now() + (60 * 1000)
      const requestIp = ctx.request.ip || ctx.request.headers['x-forwarded-for'] || ctx.request.headers['x-real-ip'] || 'unknown'
      const userAgent = ctx.request.headers['user-agent'] || 'unknown'

      await sql.db
        .insert(sql.schema.authRequests)
        .values({
          id: requestId,
          appId: appId,
          userId: userIdForRequest,
          status: 'CREATED',
          requestIp,
          userAgent,
          expiresAt,
          createdAt: Date.now()
        })

      await recordAuthEvent({ authRequestId: requestId, eventType: 'CREATED', metadata: { resend: true } }).catch(() => {})

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
        state: _state,
        appName,
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
        console.error('[web] Email resend error:', mailErr)
        errorMsg = mailErr?.message || 'Email resend failed'
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
        if (!sent && config.debug) {
          console.log('[web] Email resend code (dev only):', code, 'for', normalizedEmail)
        }
      }

      await transitionAuthRequest({
        authRequestId: requestId,
        newStatus: AuthRequestStatus.PENDING,
        metadata: { source: 'email_code_sent', resend: true }
      }).catch((err) => {
        console.warn('[web] CREATED→PENDING transition failed (non-fatal):', err?.message)
      })

      ctx.body = {
        result: true,
        request_id: requestId,
        verify_url: verifyEmailUrl,
        message: text.resendSuccessMessage
      }
    } catch (e) {
      console.error('Resend email code error:', e)
      ctx.status = 500
      const authLocale = resolveAuthLocale(ctx)
      const text = getAuthText(authLocale)
      ctx.body = { error: 'server_error', error_description: text.resendServerError }
    }
  })
}
