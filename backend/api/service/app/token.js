'use strict'

import { eq, and } from 'drizzle-orm'
import jwt from 'jsonwebtoken'
import config from '../../../config.js'
import { sql } from '../../../lib/index.js'
import { logSuccess, logFailure } from '../../../service/audit.js'
import { consumeAuthCode } from '../../../service/transition.js'
import { timingSafeEqualString } from '../../../util/cryptoEqual.js'

function parseExpiresToSeconds(expires) {
  if (!expires || typeof expires !== 'string') return 31536000
  const m = expires.trim().match(/^(\d+)([smhd])$/)
  if (!m) return 31536000
  const n = parseInt(m[1], 10)
  switch (m[2]) {
    case 's': return n
    case 'm': return n * 60
    case 'h': return n * 3600
    case 'd': return n * 86400
    default: return 31536000
  }
}

export function register(route) {
  route.post('/token', async (ctx) => {
    try {
      const body = ctx.request.body || {}
      const { grant_type, code, client_id, client_secret, redirect_uri } = body

      if (grant_type !== 'authorization_code') {
        ctx.status = 400
        ctx.body = { error: 'unsupported_grant_type', error_description: 'grant_type은 "authorization_code"만 지원됩니다.' }
        return
      }
      if (!code) {
        ctx.status = 400
        ctx.body = { error: 'invalid_request', error_description: 'code 파라미터가 필요합니다.' }
        return
      }
      if (!client_id) {
        ctx.status = 400
        ctx.body = { error: 'invalid_request', error_description: 'client_id 파라미터가 필요합니다.' }
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
      // 인증 우회 방지: PKCE(code_challenge)가 서버에 저장/검증되지 않으므로 code_verifier 제공만으로
      // client_secret 검증을 건너뛰면 안 된다(탈취된 authorization code만으로 토큰 발급 가능). 따라서
      // confidential client 교환은 항상 client_secret을 검증한다.
      // (추후 /authorize 에서 code_challenge 를 저장하고 여기서 S256 검증을 구현하면 PKCE 공개 클라이언트 허용 가능)
      if (!timingSafeEqualString(client_secret, application.clientSecret)) {
        ctx.status = 401
        ctx.body = { error: 'invalid_client', error_description: '유효하지 않은 client_secret입니다.' }
        return
      }

      const codeResult = await consumeAuthCode({ code })
      if (!codeResult.success) {
        ctx.status = 400
        ctx.body = { error: 'invalid_grant', error_description: codeResult.error || '유효하지 않은 authorization code입니다.' }
        return
      }

      const authRequest = await sql.db
        .select()
        .from(sql.schema.authRequests)
        .where(eq(sql.schema.authRequests.id, codeResult.authRequestId))
        .limit(1)
        .get()

      if (!authRequest) {
        ctx.status = 400
        ctx.body = { error: 'invalid_grant', error_description: '인증 요청을 찾을 수 없습니다.' }
        return
      }
      if (redirect_uri && redirect_uri !== application.callbackUrl) {
        ctx.status = 400
        ctx.body = { error: 'invalid_request', error_description: 'redirect_uri가 일치하지 않습니다.' }
        return
      }

      const user = await sql.db
        .select()
        .from(sql.schema.users)
        .where(eq(sql.schema.users.id, authRequest.userId))
        .limit(1)
        .get()

      if (!user || user.status === 'INACTIVE') {
        ctx.status = 400
        ctx.body = { error: 'invalid_grant', error_description: '사용자를 찾을 수 없거나 비활성화된 사용자입니다.' }
        return
      }

      await sql.db
        .update(sql.schema.users)
        .set({ lastLoginAt: Date.now() })
        .where(eq(sql.schema.users.id, user.id))
        .catch(() => {})

      const deviceId = body.device_id != null ? String(body.device_id).trim() || null : null
      const accessPayload = {
        profile: {
          id: user.id,
          identifierType: user.identifierType,
          identifierHash: user.identifierHash,
          nickname: user.nickname || null,
          status: user.status
        }
      }
      if (deviceId) accessPayload.device_id = deviceId
      const refreshPayload = { id: user.id, type: 'refresh' }
      if (deviceId) refreshPayload.device_id = deviceId

      const accessExpires = config.auth.accessApp || config.auth.access
      const accessToken = jwt.sign(accessPayload, config.auth.secret, { expiresIn: accessExpires })
      const refreshToken = jwt.sign(refreshPayload, config.auth.secret, { expiresIn: config.auth.refresh })

      const expiresInSeconds = typeof accessExpires === 'string' && /^\d+[smhd]$/.test(accessExpires.trim())
        ? parseExpiresToSeconds(accessExpires)
        : 21600

      ctx.body = {
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: expiresInSeconds,
        refresh_token: refreshToken,
        scope: 'email phone'
      }
      await logSuccess(ctx, 'token_exchange', 'Token exchange successful', { user_id: user.id, client_id: application.clientId })
    } catch (e) {
      console.error('Token exchange error:', e)
      ctx.body = await logFailure(ctx, 'token_exchange', 'Token exchange failed', e)
      if (!ctx.body.error) {
        ctx.status = 500
        ctx.body = { error: 'server_error', error_description: '토큰 교환 중 오류가 발생했습니다.' }
      }
    }
  })
}
