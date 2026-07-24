'use strict'

import { eq, and, inArray, isNull } from 'drizzle-orm'
import config from '../config.js'
import { admin, isFirebaseInitialized } from '../lib/firebase.js'
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
      .select({ userId: sql.schema.authRequests.userId })
      .from(sql.schema.authRequests)
      .where(eq(sql.schema.authRequests.id, requestId))
      .limit(1)
    if (!row?.userId) return { sent: false, allFailed: false, noTokens: true }

    const devices = await sql.db
      .select({ pushToken: sql.schema.devices.pushToken })
      .from(sql.schema.devices)
      .where(and(
        eq(sql.schema.devices.userId, row.userId),
        isNull(sql.schema.devices.revokedAt)
      ))
    const tokens = devices
      .map((d) => d.pushToken)
      .filter((t) => typeof t === 'string' && t.trim() && t.trim() !== `pending_${row.userId}`)
    if (tokens.length === 0) return { sent: false, allFailed: false, noTokens: true }

    const message = {
      notification: {
        title: '인증 요청',
        body: '새 인증 요청이 있습니다. 앱에서 확인해 주세요.'
      },
      data: { request_id: requestId },
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
      },
      tokens
    }
    const resp = await admin.messaging().sendEachForMulticast(message)
    console.log(
      '[notification] FCM multicast:',
      resp.successCount,
      'ok,',
      resp.failureCount,
      'failed'
    )

    // 무효 토큰 자동 revoke
    // third-party-auth-error는 APNs 서버 설정 문제로 토큰 revoke 대상이 아님
    const invalidCodes = new Set(['messaging/invalid-registration-token', 'messaging/registration-token-not-registered'])
    const revokeTargets = []
    resp.responses.forEach((r, i) => {
      if (!r.success) {
        const code = r.error?.code ?? 'unknown'
        console.warn('[notification] FCM 실패 토큰:', tokens[i]?.substring(0, 20) + '...', '에러:', code)
        if (invalidCodes.has(code)) revokeTargets.push(tokens[i])
      }
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

    return { sent: true, allFailed: resp.successCount === 0, noTokens: false }
  } catch (err) {
    if (config.debug) console.warn('[notification] requestAuthNotification failed:', err?.message || err)
    throw err
  }
}
