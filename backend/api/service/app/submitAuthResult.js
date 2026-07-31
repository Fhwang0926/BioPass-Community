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
      // Placeholder (user_id '0') requests must complete via email/device binding —
      // never allow any logged-in app user to approve/deny by request_id alone.
      if (String(authRequest.userId) === '0') {
        ctx.status = 403
        ctx.body = {
          error: 'forbidden',
          error_description: '미연결 인증 요청은 앱에서 승인할 수 없습니다. 이메일 인증을 완료하세요.'
        }
        return
      }
      if (String(authRequest.userId) !== String(profile.id)) {
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

      ctx.body = await logSuccess(ctx, 'submit_auth_result', 'Auth result submitted', { result: true, request_id, status: newStatus })
    } catch (e) {
      ctx.body = await logFailure(ctx, 'submit_auth_result', 'Submit auth result failed', e)
    }
  })
}
