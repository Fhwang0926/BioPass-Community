'use strict'

import { eq } from 'drizzle-orm'
import { sql } from '../../../lib/index.js'
import { logSuccess, logFailure } from '../../../service/audit.js'

const makeRetiredToken = (deviceRow, now) => `retired_${deviceRow.id}_${now}`

const pickBestRow = (rows) => {
  if (!rows.length) return null
  return [...rows].sort((a, b) => {
    const aActive = a.revokedAt == null ? 1 : 0
    const bActive = b.revokedAt == null ? 1 : 0
    if (aActive !== bActive) return bActive - aActive

    const aSeen = a.lastSeenAt ?? a.createdAt ?? 0
    const bSeen = b.lastSeenAt ?? b.createdAt ?? 0
    return bSeen - aSeen
  })[0]
}

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
      const normalizedDeviceId = typeof device_id === 'string' && device_id.trim() ? device_id.trim() : null
      const pendingToken = `pending_${userId}`

      await sql.db.transaction(async (tx) => {
        const userDevices = await tx
          .select()
          .from(sql.schema.devices)
          .where(eq(sql.schema.devices.userId, userId))

        const activeDevices = userDevices.filter((device) => device.revokedAt == null)
        const targetByDeviceId = normalizedDeviceId
          ? pickBestRow(userDevices.filter((device) => device.deviceId === normalizedDeviceId))
          : null
        const pendingDevice = pickBestRow(userDevices.filter((device) => device.pushToken === pendingToken))
        const tokenOwner = pickBestRow(userDevices.filter((device) => device.pushToken === cleanToken))
        const fallbackActive = pickBestRow(activeDevices)

        const canonicalDevice =
          targetByDeviceId ||
          tokenOwner ||
          pendingDevice ||
          fallbackActive ||
          null

        const duplicateRows = userDevices.filter((device) => (
          device.id !== canonicalDevice?.id &&
          (device.pushToken === cleanToken || device.pushToken === pendingToken)
        ))

        for (const duplicate of duplicateRows) {
          await tx
            .update(sql.schema.devices)
            .set({
              pushToken: makeRetiredToken(duplicate, now),
              revokedAt: now,
              lastSeenAt: now
            })
            .where(eq(sql.schema.devices.id, duplicate.id))
        }

        if (canonicalDevice) {
          const updatePayload = {
            pushToken: cleanToken,
            lastSeenAt: now,
            revokedAt: null
          }
          if (normalizedDeviceId) updatePayload.deviceId = normalizedDeviceId

          await tx
            .update(sql.schema.devices)
            .set(updatePayload)
            .where(eq(sql.schema.devices.id, canonicalDevice.id))
        }
      })

      ctx.body = await logSuccess(ctx, 'update_push_token', 'Push token updated', { result: true })
    } catch (e) {
      ctx.body = await logFailure(ctx, 'update_push_token', 'Push token update failed', e)
    }
  })
}
