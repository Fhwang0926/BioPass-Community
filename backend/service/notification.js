'use strict'

import { eq, and, inArray, isNull } from 'drizzle-orm'
import config from '../config.js'
import { admin, isFirebaseInitialized } from '../lib/firebase.js'
import { hmacSha256Hex, randomBytesHex } from '../lib/forge.js'
import { sql } from '../lib/index.js'

/**
 * 인증 요청 알림: request_id로 auth_request의 user_id를 조회한 뒤,
 * 해당 사용자의 등록 디바이스 FCM 토큰으로 푸시를 보냅니다.
 * @param {string} requestId - auth_requests.id (인증 요청 ID)
 * @returns {Promise<{ sent: boolean, allFailed: boolean, noTokens: boolean }>}
 *   sent: 전송 시도 여부, allFailed: 전체 실패 여부, noTokens: 유효 토큰 없음
 */
export async function requestAuthNotification(requestId) {
  if (typeof requestId !== 'string' || !requestId.trim()) return { sent: false, allFailed: false, noTokens: true }
  if (!isFirebaseInitialized()) return { sent: false, allFailed: false, noTokens: true }

  try {
    const [row] = await sql.db
      .select({
        userId: sql.schema.authRequests.userId,
        status: sql.schema.authRequests.status,
        expiresAt: sql.schema.authRequests.expiresAt
      })
      .from(sql.schema.authRequests)
      .where(eq(sql.schema.authRequests.id, requestId))
      .limit(1)
    if (!row?.userId) return { sent: false, allFailed: false, noTokens: true }

    const devices = await sql.db
      .select({
        pushToken: sql.schema.devices.pushToken,
        deviceSecret: sql.schema.devices.deviceSecret
      })
      .from(sql.schema.devices)
      .where(and(
        eq(sql.schema.devices.userId, row.userId),
        isNull(sql.schema.devices.revokedAt)
      ))
    const targets = devices.filter((device) =>
      typeof device.pushToken === 'string' &&
      device.pushToken.trim() &&
      device.pushToken.trim() !== `pending_${row.userId}` &&
      typeof device.deviceSecret === 'string' &&
      device.deviceSecret.trim()
    )
    if (targets.length === 0) return { sent: false, allFailed: false, noTokens: true }

    const issuedAt = Date.now()
    const sendResults = await Promise.allSettled(
      targets.map(async (target) => {
        const nonce = `pn_${randomBytesHex(8)}`
        const signaturePayload = `${requestId}:${row.userId}:${row.status}:${row.expiresAt}:${issuedAt}:${nonce}`
        const signature = hmacSha256Hex(target.deviceSecret, signaturePayload)
        const message = {
          token: target.pushToken,
          notification: {
            title: '인증 요청',
            body: '새 인증 요청이 있습니다. 앱에서 확인해 주세요.'
          },
          data: {
            request_id: requestId,
            user_id: String(row.userId),
            status: String(row.status ?? ''),
            expires_at: String(row.expiresAt ?? ''),
            issued_at: String(issuedAt),
            nonce,
            signature
          },
          apns: {
            headers: {
              'apns-push-type': 'alert',
              'apns-priority': '10'
            },
            payload: {
              aps: {
                alert: {
                  title: '인증 요청',
                  body: '새 인증 요청이 있습니다. 앱에서 확인해 주세요.'
                },
                sound: 'default'
              }
            }
          }
        }
        await admin.messaging().send(message)
        return { token: target.pushToken }
      })
    )
    const successCount = sendResults.filter((result) => result.status === 'fulfilled').length
    const failureCount = sendResults.length - successCount
    console.log('[notification] FCM send:', successCount, 'ok,', failureCount, 'failed')

    // 무효 토큰 자동 revoke
    // third-party-auth-error는 APNs 서버 설정 문제로 토큰 revoke 대상이 아님
    const invalidCodes = new Set(['messaging/invalid-registration-token', 'messaging/registration-token-not-registered'])
    const revokeTargets = []
    sendResults.forEach((result, index) => {
      if (result.status === 'fulfilled') return
      const token = targets[index]?.pushToken
      const code = result.reason?.code ?? 'unknown'
      console.warn('[notification] FCM 실패 토큰:', token?.substring(0, 20) + '...', '에러:', code)
      if (token && invalidCodes.has(code)) revokeTargets.push(token)
    })
    if (revokeTargets.length > 0) {
      await sql.db
        .update(sql.schema.devices)
        .set({ revokedAt: Date.now() })
        .where(
          and(
            eq(sql.schema.devices.userId, row.userId),
            inArray(sql.schema.devices.pushToken, revokeTargets)
          )
        )
        .catch((e) => console.warn('[notification] 토큰 revoke 실패:', e?.message))
      console.log('[notification] 무효 토큰', revokeTargets.length, '개 revoke 완료')
    }

    return { sent: true, allFailed: successCount === 0, noTokens: false }
  } catch (err) {
    if (config.debug) console.warn('[notification] requestAuthNotification failed:', err?.message || err)
    throw err
  }
}
