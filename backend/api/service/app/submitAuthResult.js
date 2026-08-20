'use strict'

import { timingSafeEqual } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { hmacSha256Hex } from '../../../lib/forge.js'
import { sql } from '../../../lib/index.js'
import { logSuccess, logFailure } from '../../../service/audit.js'
import { AuthRequestStatus } from '../../../service/stateMachine.js'
import { transitionAuthRequest } from '../../../service/transition.js'

const PLACEHOLDER_USER_ID = '0'
const REQUEST_SKEW_MS = 5 * 60 * 1000

function safeCompareHex(left, right) {
  if (!left || !right) return false
  const leftBuffer = Buffer.from(String(left), 'hex')
  const rightBuffer = Buffer.from(String(right), 'hex')
  if (leftBuffer.length === 0 || leftBuffer.length !== rightBuffer.length) {
    return false
  }
  return timingSafeEqual(leftBuffer, rightBuffer)
}

export function register(route) {
  route.post('/submit-auth-result', async (ctx) => {
    try {
      // JWT 검증: 앱 사용자만 승인/거절 제출 가능
      const profile = ctx.request.profile
      if (!profile?.id) {
        ctx.status = 401
        ctx.body = { error: 'unauthorized', error_description: 'JWT 토큰이 필요합니다.' }
        return
      }

      const body = ctx.request.body || {}
      const {
        request_id,
        result,
        device_id,
        timestamp,
        nonce,
        signature,
        user_id: _user_id
      } = body
      if (!request_id) {
        ctx.status = 400
        ctx.body = { error: 'invalid_request', error_description: 'request_id가 필요합니다.' }
        return
      }
      const newStatus = result === 'approve' ? AuthRequestStatus.APPROVED : AuthRequestStatus.DENIED
      if (result !== 'approve' && result !== 'deny') {
        ctx.status = 400
        ctx.body = { error: 'invalid_request', error_description: 'result는 "approve" 또는 "deny"여야 합니다.' }
        return
      }
      if (!device_id || !timestamp || !nonce || !signature) {
        ctx.status = 400
        ctx.body = { error: 'invalid_request', error_description: 'device_id, timestamp, nonce, signature가 필요합니다.' }
        return
      }

      const requestTimestamp = Number(timestamp)
      if (!Number.isFinite(requestTimestamp)) {
        ctx.status = 400
        ctx.body = { error: 'invalid_request', error_description: 'timestamp 형식이 올바르지 않습니다.' }
        return
      }
      if (Math.abs(Date.now() - requestTimestamp) > REQUEST_SKEW_MS) {
        ctx.status = 400
        ctx.body = { error: 'invalid_request', error_description: '유효 시간이 지난 승인 응답입니다.' }
        return
      }

      const authRequest = await sql.db
        .select()
        .from(sql.schema.authRequests)
        .where(eq(sql.schema.authRequests.id, request_id))
        .limit(1)
        .get()

      if (!authRequest) {
        ctx.status = 404
        ctx.body = { error: 'not_found', error_description: '인증 요청을 찾을 수 없습니다.' }
        return
      }
      if (authRequest.expiresAt && authRequest.expiresAt <= Date.now()) {
        ctx.status = 410
        ctx.body = { error: 'expired_request', error_description: '이미 만료된 인증 요청입니다.' }
        return
      }
      if (authRequest.status !== AuthRequestStatus.CREATED && authRequest.status !== AuthRequestStatus.PENDING) {
        ctx.status = 409
        ctx.body = { error: 'already_processed', error_description: '이미 처리된 인증 요청입니다.' }
        return
      }

      const isPlaceholderUser = String(authRequest.userId) === PLACEHOLDER_USER_ID
      // 권한: JWT 사용자와 인증 요청의 user_id가 일치해야 함 (placeholder는 device 서명으로 검증)
      if (!isPlaceholderUser && String(authRequest.userId) !== String(profile.id)) {
        ctx.status = 403
        ctx.body = { error: 'forbidden', error_description: '해당 인증 요청에 대한 권한이 없습니다.' }
        return
      }

      const registeredDevice = await sql.db
        .select()
        .from(sql.schema.devices)
        .where(and(
          eq(sql.schema.devices.userId, String(profile.id)),
          eq(sql.schema.devices.deviceId, String(device_id))
        ))
        .limit(1)
        .get()

      if (!registeredDevice) {
        ctx.status = 403
        ctx.body = { error: 'forbidden', error_description: '현재 사용자에게 등록된 기기가 아닙니다.' }
        return
      }
      if (registeredDevice.revokedAt) {
        ctx.status = 403
        ctx.body = { error: 'forbidden', error_description: '사용 중지된 기기입니다.' }
        return
      }

      const priorEvents = await sql.db
        .select({
          eventType: sql.schema.authEvents.eventType,
          detail: sql.schema.authEvents.detail
        })
        .from(sql.schema.authEvents)
        .where(eq(sql.schema.authEvents.authRequestId, request_id))
        .all()

      const nonceReused = priorEvents.some((event) => {
        if (!event.detail) return false
        try {
          const detail = JSON.parse(event.detail)
          return detail?.responseNonce === nonce
        } catch {
          return false
        }
      })
      if (nonceReused) {
        ctx.status = 409
        ctx.body = { error: 'replayed_response', error_description: '이미 사용된 승인 응답입니다.' }
        return
      }

      const expectedSignature = hmacSha256Hex(
        registeredDevice.deviceSecret,
        `${request_id}:${result}:${device_id}:${requestTimestamp}:${nonce}`
      )
      if (!safeCompareHex(expectedSignature, signature)) {
        ctx.status = 400
        ctx.body = { error: 'invalid_signature', error_description: '승인 응답 서명이 유효하지 않습니다.' }
        return
      }

      const transitionResult = await transitionAuthRequest({
        authRequestId: request_id,
        newStatus,
        metadata: {
          source: 'app',
          deviceId: registeredDevice.id,
          appDeviceId: registeredDevice.deviceId,
          responseNonce: nonce,
          responseTimestamp: requestTimestamp
        }
      })
      if (!transitionResult.success) {
        ctx.status = 400
        ctx.body = { error: 'invalid_transition', error_description: transitionResult.error || '상태 전이가 허용되지 않습니다.' }
        return
      }

      // 인증 요청이 플레이스홀더(user_id '0')였으면 승인/거절한 앱 사용자로 연결 (JWT 사용자)
      const approverUserId = profile.id && String(profile.id).startsWith('usr_') ? profile.id : null
      if (isPlaceholderUser && approverUserId) {
        await sql.db
          .update(sql.schema.authRequests)
          .set({ userId: approverUserId })
          .where(eq(sql.schema.authRequests.id, request_id))
          .catch((err) => { console.warn('[submit-auth-result] userId update failed (non-fatal):', err?.message) })
      }

      ctx.body = await logSuccess(ctx, 'submit_auth_result', 'Auth result submitted', { result: true, request_id, status: newStatus })
    } catch (e) {
      ctx.body = await logFailure(ctx, 'submit_auth_result', 'Submit auth result failed', e)
    }
  })
}
