'use strict'

import { eq } from 'drizzle-orm'
import { sql } from '../../../lib/index.js'
import { logSuccess, logFailure } from '../../../service/audit.js'
import { AuthRequestStatus } from '../../../service/stateMachine.js'
import { transitionAuthRequest } from '../../../service/transition.js'

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
      const { request_id, result, user_id: _user_id } = body
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
      const isPlaceholderUser = String(authRequest.userId) === '0'
      // 권한: JWT 사용자와 인증 요청의 user_id가 일치해야 함 (placeholder는 누구나 승인/거절 가능한 요청이므로 통과)
      if (!isPlaceholderUser && String(authRequest.userId) !== String(profile.id)) {
        ctx.status = 403
        ctx.body = { error: 'forbidden', error_description: '해당 인증 요청에 대한 권한이 없습니다.' }
        return
      }

      const transitionResult = await transitionAuthRequest({
        authRequestId: request_id,
        newStatus,
        metadata: { source: 'app' }
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
