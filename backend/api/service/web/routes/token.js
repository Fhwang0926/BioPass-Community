'use strict'

import { eq, and } from 'drizzle-orm'
import jwt from 'jsonwebtoken'
import config from '../../../../config.js'
import { sql } from '../../../../lib/index.js'
import { logSuccess, logFailure } from '../../../../service/audit.js'
import { consumeAuthCode } from '../../../../service/transition.js'
import { timingSafeEqualString } from '../../../../util/cryptoEqual.js'
import { renderErrorPage } from '../render.js'

function resolveVerifiedUser(profile, user) {
  const identifierType = user?.identifierType || profile.identifierType || ''
  const identifierValue = user?.identifierValue || ''
  const email = profile.email || (identifierType === 'email' ? identifierValue : null)
  const phone = profile.phone || (identifierType === 'phone' ? identifierValue : null)
  const nickname = user?.nickname || profile.nickname || null
  const name = profile.name || nickname || (email ? String(email).split('@')[0] : null)

  return {
    id: user?.id || profile.id,
    email,
    name,
    nickname,
    phone,
    status: user?.status || profile.status || null
  }
}

export function register(route) {
  route.post('/token', async (ctx) => {
    const tokenAcceptsHtml = ctx.request.headers.accept && ctx.request.headers.accept.includes('text/html')
    const tokenBaseUrl = ctx.request.origin || `${ctx.request.protocol}://${ctx.request.host}`
    const sendTokenError = (status, error, errorDescription) => {
      ctx.status = status
      if (tokenAcceptsHtml) {
        ctx.type = 'text/html'
        ctx.body = renderErrorPage(status, error, errorDescription, tokenBaseUrl)
      } else {
        ctx.body = { error, error_description: errorDescription }
      }
    }

    try {
      const body = ctx.request.body || {}
      const { grant_type, code, client_id, client_secret, redirect_uri } = body

      if (grant_type !== 'authorization_code') {
        sendTokenError(400, 'unsupported_grant_type', 'grant_type은 "authorization_code"만 지원됩니다.')
        return
      }

      if (!code) {
        sendTokenError(400, 'invalid_request', 'code 파라미터가 필요합니다.')
        return
      }

      if (!client_id) {
        sendTokenError(400, 'invalid_request', 'client_id 파라미터가 필요합니다.')
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
        sendTokenError(400, 'invalid_client', '유효하지 않은 client_id입니다.')
        return
      }

      if (!application.isActive) {
        sendTokenError(400, 'invalid_client', '비활성화된 애플리케이션입니다.')
        return
      }

      // 인증 우회 방지: PKCE(code_challenge)가 서버에 저장/검증되지 않으므로 code_verifier 제공만으로
      // client_secret 검증을 건너뛰면 안 된다(탈취된 authorization code만으로 토큰 발급 가능). 따라서
      // confidential client 교환은 항상 client_secret을 검증한다.
      if (!timingSafeEqualString(client_secret, application.clientSecret)) {
        sendTokenError(401, 'invalid_client', '유효하지 않은 client_secret입니다.')
        return
      }

      const codeResult = await consumeAuthCode({ code })

      if (!codeResult.success) {
        sendTokenError(400, 'invalid_grant', codeResult.error || '유효하지 않은 authorization code입니다.')
        return
      }

      const authRequest = await sql.db
        .select()
        .from(sql.schema.authRequests)
        .where(eq(sql.schema.authRequests.id, codeResult.authRequestId))
        .limit(1)
        .get()

      if (!authRequest) {
        sendTokenError(400, 'invalid_grant', '인증 요청을 찾을 수 없습니다.')
        return
      }

      if (redirect_uri && redirect_uri !== application.callbackUrl) {
        sendTokenError(400, 'invalid_request', 'redirect_uri가 일치하지 않습니다.')
        return
      }

      const user = await sql.db
        .select()
        .from(sql.schema.users)
        .where(eq(sql.schema.users.id, authRequest.userId))
        .limit(1)
        .get()

      if (!user || user.status === 'INACTIVE') {
        sendTokenError(400, 'invalid_grant', '사용자를 찾을 수 없거나 비활성화된 사용자입니다.')
        return
      }

      await sql.db
        .update(sql.schema.users)
        .set({ lastLoginAt: Date.now() })
        .where(eq(sql.schema.users.id, user.id))
        .catch(() => {})

      const accessToken = jwt.sign(
        { profile: { id: user.id, identifierType: user.identifierType, identifierHash: user.identifierHash, nickname: user.nickname || null, status: user.status } },
        config.auth.secret,
        { expiresIn: config.auth.access }
      )

      const refreshToken = jwt.sign(
        { id: user.id, type: 'refresh' },
        config.auth.secret,
        { expiresIn: config.auth.refresh }
      )

      ctx.body = {
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: 21600,
        refresh_token: refreshToken,
        scope: 'email phone'
      }

      await logSuccess(ctx, 'token_exchange', 'Token exchange successful', {
        user_id: user.id,
        client_id: application.clientId
      })
    } catch (e) {
      console.error('Token exchange error:', e)
      const tokenAcceptsHtml = ctx.request.headers.accept && ctx.request.headers.accept.includes('text/html')
      if (tokenAcceptsHtml) {
        ctx.status = 500
        ctx.type = 'text/html'
        const baseUrl = ctx.request.origin || `${ctx.request.protocol}://${ctx.request.host}`
        ctx.body = renderErrorPage(500, 'server_error', (e?.message || '토큰 교환 중 오류가 발생했습니다.'), baseUrl)
      } else {
        ctx.body = await logFailure(ctx, 'token_exchange', 'Token exchange failed', e)
        if (!ctx.body.error) {
          ctx.status = 500
          ctx.body = {
            error: 'server_error',
            error_description: '토큰 교환 중 오류가 발생했습니다.'
          }
        }
      }
    }
  })

  route.post('/verify-token', async (ctx) => {
    const acceptJson = ctx.request.headers.accept && ctx.request.headers.accept.includes('application/json')
    const sendError = (status, error, errorDescription) => {
      ctx.status = status
      ctx.body = { success: false, error, error_description: errorDescription }
    }

    try {
      const body = ctx.request.body || {}
      let token = (body.token != null && String(body.token).trim()) ? String(body.token).trim() : ''
      if (!token && ctx.request.headers.authorization) {
        const bearer = ctx.request.headers.authorization
        if (/^Bearer\s+/i.test(bearer)) token = bearer.replace(/^Bearer\s+/i, '').trim()
      }
      const client_id = (body.client_id != null && String(body.client_id).trim()) ? String(body.client_id).trim() : ''
      const client_secret = body.client_secret != null ? String(body.client_secret) : ''

      if (!token) {
        sendError(400, 'invalid_request', 'token이 필요합니다. (Body 또는 Authorization: Bearer)')
        return
      }
      if (!client_id) {
        sendError(400, 'invalid_request', 'client_id가 필요합니다.')
        return
      }
      if (client_secret === '') {
        sendError(400, 'invalid_request', 'client_secret이 필요합니다.')
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
        sendError(401, 'invalid_client', '유효하지 않은 client_id입니다.')
        return
      }
      if (!application.isActive) {
        sendError(401, 'invalid_client', '비활성화된 애플리케이션입니다.')
        return
      }
      if (!timingSafeEqualString(client_secret, application.clientSecret)) {
        sendError(401, 'invalid_client', '유효하지 않은 client_secret입니다.')
        return
      }

      let decoded
      try {
        decoded = jwt.verify(token, config.auth.secret)
      } catch (jwtErr) {
        if (jwtErr.name === 'TokenExpiredError') {
          sendError(401, 'invalid_token', '토큰이 만료되었습니다.')
          return
        }
        if (jwtErr.name === 'JsonWebTokenError') {
          sendError(401, 'invalid_token', '유효하지 않은 토큰입니다.')
          return
        }
        sendError(401, 'invalid_token', jwtErr.message || '토큰 검증에 실패했습니다.')
        return
      }

      const profile = decoded.profile || decoded
      if (!profile || (typeof profile.id === 'undefined' && !profile.email)) {
        sendError(401, 'invalid_token', '토큰에 사용자 정보가 없습니다.')
        return
      }

      const user = profile.id
        ? await sql.db
          .select({
            id: sql.schema.users.id,
            identifierType: sql.schema.users.identifierType,
            identifierValue: sql.schema.users.identifierValue,
            nickname: sql.schema.users.nickname,
            status: sql.schema.users.status
          })
          .from(sql.schema.users)
          .where(eq(sql.schema.users.id, profile.id))
          .limit(1)
          .get()
        : null

      if (profile.id && (!user || user.status === 'INACTIVE')) {
        sendError(401, 'invalid_token', '사용자를 찾을 수 없거나 비활성화된 사용자입니다.')
        return
      }

      ctx.body = {
        success: true,
        authenticated: true,
        user: resolveVerifiedUser(profile, user)
      }

      if (acceptJson) {
        await logSuccess(ctx, 'verify_token', 'Token verification successful', {
          client_id: application.clientId,
          user_id: profile.id
        }).catch(() => {})
      }
    } catch (e) {
      console.error('Verify token error:', e)
      sendError(500, 'server_error', e?.message || '인증 조회 중 오류가 발생했습니다.')
    }
  })
}
