'use strict'

import { eq } from 'drizzle-orm'
import { sql } from '../../../../lib/index.js'
import { consumeRateLimit } from '../../../../lib/rateLimit.js'
import { requestAuthNotification } from '../../../../service/notification.js'
import { AuthRequestStatus } from '../../../../service/stateMachine.js'
import { transitionAuthRequest } from '../../../../service/transition.js'
import { hasRegisteredPushDevice } from '../device.js'

export function register(route) {
  route.post('/notify-auth-request', async (ctx) => {
    const body = ctx.request.body || {}
    const requestId = (body.request_id != null && String(body.request_id).trim()) ? String(body.request_id).trim() : ''
    if (!requestId) {
      ctx.status = 400
      ctx.body = { error: 'invalid_request', error_description: 'request_id가 필요합니다.' }
      return
    }

    const ip = ctx.request.from_ip || ctx.ip || 'unknown'
    const limited = consumeRateLimit({
      key: `notify-req:${ip}:${requestId}`,
      limit: 10,
      windowMs: 10 * 60 * 1000
    })
    if (!limited.allowed) {
      ctx.status = 429
      ctx.set('Retry-After', String(limited.retryAfterSec))
      ctx.body = { error: 'rate_limited', error_description: 'Too many notification requests for this auth request.' }
      return
    }

    const authReq = await sql.db
      .select({ id: sql.schema.authRequests.id, status: sql.schema.authRequests.status, userId: sql.schema.authRequests.userId })
      .from(sql.schema.authRequests)
      .where(eq(sql.schema.authRequests.id, requestId))
      .limit(1)
      .get()
    if (!authReq || (authReq.status !== AuthRequestStatus.PENDING && authReq.status !== AuthRequestStatus.CREATED)) {
      ctx.status = 400
      ctx.body = { error: 'invalid_request', error_description: '유효한 인증 요청이 없거나 이미 처리되었습니다.' }
      return
    }
    if (!await hasRegisteredPushDevice(sql, authReq.userId)) {
      ctx.body = { result: false, no_devices: true, message: '등록된 앱이 없습니다.' }
      return
    }
    if (authReq.status === AuthRequestStatus.CREATED) {
      await transitionAuthRequest({
        authRequestId: requestId,
        newStatus: AuthRequestStatus.PENDING,
        metadata: { source: 'notify_push' }
      }).catch((err) => { console.warn('[web] CREATED→PENDING transition failed (non-fatal):', err?.message) })
    }
    try {
      const result = await requestAuthNotification(requestId)
      if (result.noTokens) {
        ctx.body = { result: false, no_devices: true, message: '유효한 푸시 토큰이 없습니다. 앱에서 다시 로그인해 주세요.' }
        return
      }
      if (result.allFailed) {
        ctx.body = { result: false, message: '푸시 전송에 실패했습니다. 잠시 후 다시 시도해 주세요.' }
        return
      }
      ctx.body = { result: true, sent: true, message: '알림 요청을 전송했습니다.' }
    } catch (err) {
      console.error('[web] requestAuthNotification error:', err?.message)
      ctx.status = 500
      ctx.body = { error: 'notification_failed', error_description: '알림 전송 중 오류가 발생했습니다.' }
    }
  })
}
