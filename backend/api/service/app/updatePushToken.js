'use strict'

import { eq, and, isNull, ne } from 'drizzle-orm'
import { sql } from '../../../lib/index.js'
import { logSuccess, logFailure } from '../../../service/audit.js'

/**
 * FCM 푸시 토큰 갱신 엔드포인트.
 * 앱에서 FCM 토큰이 변경되었을 때 서버에 업데이트합니다.
 * JWT 인증 필수. 해당 사용자의 활성 디바이스 push_token을 갱신합니다.
 */
export function register(route) {
  route.post('/update-push-token', async (ctx) => {
    try {
      const profile = ctx.request.profile
      if (!profile?.id) {
        ctx.status = 401
        ctx.body = { error: 'unauthorized', error_description: 'JWT 토큰이 필요합니다.' }
        return
      }

      const body = ctx.request.body || {}
      const { push_token, device_id } = body
      if (!push_token || typeof push_token !== 'string' || !push_token.trim()) {
        ctx.status = 400
        ctx.body = { error: 'invalid_request', error_description: 'push_token이 필요합니다.' }
        return
      }

      const userId = profile.id
      const now = Date.now()
      const cleanToken = push_token.trim()

      // placeholder 토큰(pending_userId)을 가진 디바이스는 revoke하지 않고 실제 토큰으로 직접 교체
      // revoked_at 조건 없이 업데이트 (이전에 잘못 revoke된 경우도 복구)
      await sql.db
        .update(sql.schema.devices)
        .set({ pushToken: cleanToken, lastSeenAt: now, revokedAt: null })
        .where(
          and(
            eq(sql.schema.devices.userId, userId),
            eq(sql.schema.devices.pushToken, `pending_${userId}`)
          )
        )

      // device_id가 주어지면 해당 디바이스만, 아니면 사용자의 활성 디바이스 모두 업데이트
      if (device_id && typeof device_id === 'string' && device_id.trim()) {
        await sql.db
          .update(sql.schema.devices)
          .set({ pushToken: cleanToken, lastSeenAt: now })
          .where(
            and(
              eq(sql.schema.devices.userId, userId),
              eq(sql.schema.devices.deviceId, device_id.trim()),
              isNull(sql.schema.devices.revokedAt)
            )
          )
      } else {
        await sql.db
          .update(sql.schema.devices)
          .set({ pushToken: cleanToken, lastSeenAt: now })
          .where(
            and(
              eq(sql.schema.devices.userId, userId),
              isNull(sql.schema.devices.revokedAt),
              ne(sql.schema.devices.pushToken, cleanToken)
            )
          )
      }

      ctx.body = await logSuccess(ctx, 'update_push_token', 'Push token updated', { result: true })
    } catch (e) {
      ctx.body = await logFailure(ctx, 'update_push_token', 'Push token update failed', e)
    }
  })
}
