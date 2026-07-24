'use strict'

import { eq, and, lt } from 'drizzle-orm'
import { sha256Hex, randomBytesHex } from '../lib/forge.js'
import { sql } from '../lib/index.js'
import { validateTransition, AuthRequestStatus } from './stateMachine.js'

/**
 * auth_events에만 이벤트 한 건 기록 (상태 전이 없음)
 * - CREATED: 인증 요청 생성 직후 호출
 * - PUSH_SENT: 푸시 알림 발송 직후 호출 (푸시 연동 시 해당 위치에서 recordAuthEvent(id, 'PUSH_SENT', { deviceId }) 호출)
 * - BLOCKED: 정책에 의해 차단 시 transitionAuthRequest(..., BLOCKED, { policyId, reason }) 사용
 *
 * @param {object} params
 * @param {string} params.authRequestId - 인증 요청 ID
 * @param {string} params.eventType - 이벤트 타입 (CREATED, PUSH_SENT 등)
 * @param {object} [params.metadata] - 추가 메타데이터 (deviceId, reason 등)
 */
export async function recordAuthEvent({ authRequestId, eventType, metadata = {} }) {
  const eventId = `evt_${Date.now()}_${randomBytesHex(8)}`
  await sql.db
    .insert(sql.schema.authEvents)
    .values({
      id: eventId,
      authRequestId,
      eventType,
      detail: metadata && Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null,
      createdAt: Date.now()
    })
}

/**
 * AuthRequest 상태 전이 실행
 *
 * 이 함수는 상태 전이를 안전하게 처리합니다:
 * 1. 현재 상태 조회
 * 2. 전이 가능한지 검사
 * 3. 조건부 UPDATE (트랜잭션)
 * 4. 이벤트 기록
 *
 * ⚠️ 절대 하지 말아야 할 것:
 * ❌ 클라이언트가 status 지정
 * ❌ status 업데이트를 단순 UPDATE로 처리
 * ❌ APPROVED 상태를 영구 보관
 */

/**
 * 상태 전이 실행
 * @param {object} params
 * @param {string} params.authRequestId - 인증 요청 ID
 * @param {string} params.newStatus - 전이할 상태
 * @param {object} params.metadata - 추가 메타데이터 (deviceId, reason 등)
 * @returns {Promise<{ success: boolean, error?: string, authRequest?: object }>}
 */
export async function transitionAuthRequest({ authRequestId, newStatus, metadata = {} }) {
  try {
    // 1. 현재 상태 조회
    const authRequest = await sql.db
      .select()
      .from(sql.schema.authRequests)
      .where(eq(sql.schema.authRequests.id, authRequestId))
      .limit(1)
      .get()

    if (!authRequest) {
      return { success: false, error: 'Auth request not found' }
    }

    // 2. 전이 가능한지 검사
    const validation = validateTransition(authRequest.status, newStatus)
    if (!validation.valid) {
      return { success: false, error: validation.error }
    }

    // 3. 만료 시간 체크 (EXPIRED 전이인 경우)
    if (newStatus === AuthRequestStatus.EXPIRED) {
      if (authRequest.expiresAt && authRequest.expiresAt > Date.now()) {
        return { success: false, error: 'Auth request has not expired yet' }
      }
    }

    // 4. 조건부 UPDATE (트랜잭션)
    const updateData = {
      status: newStatus
    }

    // 상태별 타임스탬프 설정
    if (newStatus === AuthRequestStatus.APPROVED) {
      updateData.approvedAt = Date.now()
    } else if (newStatus === AuthRequestStatus.DENIED) {
      updateData.deniedAt = Date.now()
    } else if (newStatus === AuthRequestStatus.CONSUMED) {
      updateData.consumedAt = Date.now()
    }

    // 조건부 UPDATE: 현재 상태가 예상 상태인지 확인
    const updated = await sql.db
      .update(sql.schema.authRequests)
      .set(updateData)
      .where(and(
        eq(sql.schema.authRequests.id, authRequestId),
        eq(sql.schema.authRequests.status, authRequest.status) // 현재 상태 확인
      ))
      .returning()
      .get()

    if (!updated) {
      // 동시성 문제: 다른 프로세스가 이미 상태를 변경함
      return { success: false, error: 'Auth request status was changed by another process' }
    }

    // 5. 이벤트 기록 (상태별 이벤트 타입 결정)
    const eventId = `evt_${Date.now()}_${randomBytesHex(8)}`
    let eventType = newStatus
    if (newStatus === AuthRequestStatus.PENDING) {
      // PENDING 전이 시 source에 따라 이벤트 타입 결정
      if (metadata && metadata.source === 'email_code_sent') {
        eventType = 'EMAIL_CODE_SENT'
      } else if (metadata && metadata.source === 'authorize') {
        eventType = 'PENDING'
      } else {
        eventType = 'PENDING'
      }
    } else if (newStatus === AuthRequestStatus.APPROVED) {
      eventType = (metadata && metadata.source === 'verify_email') ? 'APPROVED_BY_EMAIL' : 'APPROVED_BY_DEVICE'
    } else if (newStatus === AuthRequestStatus.DENIED) {
      eventType = 'DENIED'
    } else if (newStatus === AuthRequestStatus.EXPIRED) {
      eventType = 'EXPIRED_BY_SYSTEM'
    } else if (newStatus === AuthRequestStatus.BLOCKED) {
      eventType = 'BLOCKED'
    } else if (newStatus === AuthRequestStatus.CONSUMED) {
      eventType = 'CONSUMED'
    }
    await sql.db
      .insert(sql.schema.authEvents)
      .values({
        id: eventId,
        authRequestId: authRequestId,
        eventType,
        detail: metadata && Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null,
        createdAt: Date.now()
      })

    return { success: true, authRequest: updated }
  } catch (error) {
    console.error('Auth request transition error:', error)
    return { success: false, error: error.message || 'Transition failed' }
  }
}

/**
 * SHA-256 해시 생성 헬퍼
 * @param {string} input - 해시할 문자열
 * @returns {string} SHA-256 해시 (hex)
 */
function hashCode(input) {
  return sha256Hex(input)
}

/**
 * Auth Code 생성 (APPROVED 상태일 때)
 *
 * 보안 개선: code는 평문 저장하지 않음
 * - code_hash: SHA-256 해시로 저장
 * - 원본 code는 메모리에서만 사용 (DB에 저장하지 않음)
 * - 인증 코드 비교 시 해시 비교만 수행
 *
 * @param {object} params
 * @param {string} params.authRequestId - 인증 요청 ID
 * @param {number} params.expiresInSeconds - 만료 시간 (초)
 * @returns {Promise<{ success: boolean, code?: string, error?: string }>}
 */
export async function createAuthCode({ authRequestId, expiresInSeconds = 180 }) {
  try {
    // 만료된 PENDING 요청들을 일괄 정리 (Lazy Expire 보완)
    // 비동기로 실행하되 실패해도 코드 생성은 계속 진행
    expireStaleAuthRequests({ limit: 50 }).catch(err => {
      console.warn('Background expire stale requests failed:', err.message)
    })

    // Auth Request가 APPROVED 상태인지 확인
    const authRequest = await sql.db
      .select()
      .from(sql.schema.authRequests)
      .where(and(
        eq(sql.schema.authRequests.id, authRequestId),
        eq(sql.schema.authRequests.status, AuthRequestStatus.APPROVED)
      ))
      .limit(1)
      .get()

    if (!authRequest) {
      return { success: false, error: 'Auth request not found or not approved' }
    }

    // 기존 코드가 있는지 확인
    // 주의: 기존 코드는 해시로 저장되어 있으므로 원본을 반환할 수 없음
    // 기존 코드가 있으면 무효화하고 새 코드를 생성
    const existingCode = await sql.db
      .select()
      .from(sql.schema.authCodes)
      .where(and(
        eq(sql.schema.authCodes.authRequestId, authRequestId),
        eq(sql.schema.authCodes.consumedAt, null)
      ))
      .limit(1)
      .get()

    // 기존 코드가 있고 아직 유효한 경우 무효화 (해시만 저장되어 있어 재사용 불가)
    if (existingCode && existingCode.expiresAt > Date.now()) {
      // 기존 코드를 무효화 (consumedAt 설정)
      await sql.db
        .update(sql.schema.authCodes)
        .set({ consumedAt: Date.now() })
        .where(eq(sql.schema.authCodes.id, existingCode.id))
    }

    // 새 코드 생성 (원본은 메모리에서만 사용)
    const code = `auth_${randomBytesHex(32)}`
    const codeHash = hashCode(code) // SHA-256 해시
    const codeId = `code_${Date.now()}_${randomBytesHex(8)}`

    // 해시만 DB에 저장 (원본 code는 저장하지 않음)
    await sql.db
      .insert(sql.schema.authCodes)
      .values({
        id: codeId,
        authRequestId: authRequestId,
        codeHash: codeHash, // 해시만 저장
        expiresAt: Date.now() + (expiresInSeconds * 1000),
        createdAt: Date.now()
      })

    // 원본 code는 메모리에서만 반환 (DB에 저장되지 않음)
    return { success: true, code }
  } catch (error) {
    console.error('Auth code creation error:', error)
    return { success: false, error: error.message || 'Code creation failed' }
  }
}

/**
 * Auth Code 소비 (CONSUMED 상태로 전이)
 *
 * 보안 개선: code는 해시로 비교
 * - 입력받은 code를 SHA-256 해시로 변환
 * - DB에 저장된 code_hash와 비교
 * - 원본 code는 메모리에서만 사용
 *
 * @param {object} params
 * @param {string} params.code - 인증 코드 (원본)
 * @returns {Promise<{ success: boolean, authRequestId?: string, error?: string }>}
 */
export async function consumeAuthCode({ code }) {
  try {
    // 입력받은 code를 SHA-256 해시로 변환
    const codeHash = hashCode(code)

    // 해시로 코드 조회 (원본 code는 DB에 저장되지 않음)
    const authCode = await sql.db
      .select()
      .from(sql.schema.authCodes)
      .where(eq(sql.schema.authCodes.codeHash, codeHash))
      .limit(1)
      .get()

    if (!authCode) {
      return { success: false, error: 'Invalid auth code' }
    }

    // 이미 소비되었는지 확인
    if (authCode.consumedAt) {
      return { success: false, error: 'Auth code already consumed' }
    }

    // 만료 확인
    if (authCode.expiresAt < Date.now()) {
      return { success: false, error: 'Auth code expired' }
    }

    // Auth Request 상태 확인
    const authRequest = await sql.db
      .select()
      .from(sql.schema.authRequests)
      .where(eq(sql.schema.authRequests.id, authCode.authRequestId))
      .limit(1)
      .get()

    if (!authRequest || authRequest.status !== AuthRequestStatus.APPROVED) {
      return { success: false, error: 'Auth request not approved' }
    }

    // 코드 소비 처리
    await sql.db
      .update(sql.schema.authCodes)
      .set({ consumedAt: Date.now() })
      .where(eq(sql.schema.authCodes.id, authCode.id))

    // 상태 전이: APPROVED → CONSUMED
    // 상태 전이 무결성 강화: transitionAuthRequest 함수가 이전 status 조건을 포함하여 UPDATE 수행
    const transitionResult = await transitionAuthRequest({
      authRequestId: authCode.authRequestId,
      newStatus: AuthRequestStatus.CONSUMED,
      metadata: { codeId: authCode.id }
    })

    if (!transitionResult.success) {
      return transitionResult
    }

    return { success: true, authRequestId: authCode.authRequestId }
  } catch (error) {
    console.error('Auth code consumption error:', error)
    return { success: false, error: error.message || 'Code consumption failed' }
  }
}

/**
 * 만료된 PENDING 인증 요청들을 일괄 EXPIRED 상태로 전이
 *
 * Lazy Expire 보완: 인증 코드 발송 시점에 호출하여
 * 오랫동안 조회되지 않은 만료 요청들도 정리
 *
 * @param {object} [options]
 * @param {string} [options.appId] - 특정 앱의 요청만 정리 (선택)
 * @param {number} [options.limit] - 한 번에 처리할 최대 개수 (기본값: 100)
 * @returns {Promise<{ success: boolean, expiredCount: number, error?: string }>}
 */
export async function expireStaleAuthRequests({ appId = null, limit = 100 } = {}) {
  try {
    const now = Date.now()

    // 만료된 PENDING 요청 조회
    let query = sql.db
      .select({ id: sql.schema.authRequests.id })
      .from(sql.schema.authRequests)
      .where(and(
        eq(sql.schema.authRequests.status, AuthRequestStatus.PENDING),
        lt(sql.schema.authRequests.expiresAt, now)
      ))
      .limit(limit)

    // appId가 지정된 경우 해당 앱의 요청만 조회
    if (appId) {
      query = sql.db
        .select({ id: sql.schema.authRequests.id })
        .from(sql.schema.authRequests)
        .where(and(
          eq(sql.schema.authRequests.appId, appId),
          eq(sql.schema.authRequests.status, AuthRequestStatus.PENDING),
          lt(sql.schema.authRequests.expiresAt, now)
        ))
        .limit(limit)
    }

    const expiredPending = await query.all()

    if (expiredPending.length === 0) {
      return { success: true, expiredCount: 0 }
    }

    // 각 요청을 EXPIRED로 전이 (이벤트 기록 포함)
    const results = await Promise.allSettled(
      expiredPending.map((r) =>
        transitionAuthRequest({
          authRequestId: r.id,
          newStatus: AuthRequestStatus.EXPIRED,
          metadata: { reason: 'batch_expire' }
        })
      )
    )

    const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length

    return { success: true, expiredCount: successCount }
  } catch (error) {
    console.error('Expire stale auth requests error:', error)
    return { success: false, expiredCount: 0, error: error.message || 'Batch expire failed' }
  }
}
