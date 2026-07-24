'use strict'

/**
 * AuthRequest 상태 전이 헌법
 *
 * 이 파일이 상태 머신의 헌법임
 * → 여기만 봐도 시스템 이해 가능해야 함
 */

// 허용되는 상태 전이 정의
// DENIED, EXPIRED, BLOCKED, CONSUMED는 종료 상태 (더 이상 전이 불가)
export const ALLOWED_TRANSITIONS = {
  CREATED: ['PENDING', 'APPROVED'], // APPROVED: 이메일 인증 코드 확인 시 직행 (앱 미설치 경로)
  PENDING: ['APPROVED', 'DENIED', 'EXPIRED', 'BLOCKED'],
  APPROVED: ['CONSUMED']
}

// 상태 타입 정의
export const AuthRequestStatus = {
  CREATED: 'CREATED',
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  DENIED: 'DENIED',
  EXPIRED: 'EXPIRED',
  BLOCKED: 'BLOCKED',
  CONSUMED: 'CONSUMED'
}

/**
 * 상태 전이가 허용되는지 검증
 * @param {string} currentStatus - 현재 상태
 * @param {string} newStatus - 전이하려는 상태
 * @returns {boolean} 전이 가능 여부
 */
export function canTransition(currentStatus, newStatus) {
  if (!currentStatus || !newStatus) {
    return false
  }

  const allowed = ALLOWED_TRANSITIONS[currentStatus]
  if (!allowed) {
    return false // 종료 상태는 더 이상 전이 불가
  }

  return allowed.includes(newStatus)
}

/**
 * 상태 전이 검증 및 에러 메시지 생성
 * @param {string} currentStatus - 현재 상태
 * @param {string} newStatus - 전이하려는 상태
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateTransition(currentStatus, newStatus) {
  if (!currentStatus) {
    return { valid: false, error: 'Current status is required' }
  }

  if (!newStatus) {
    return { valid: false, error: 'New status is required' }
  }

  if (currentStatus === newStatus) {
    return { valid: false, error: `Status is already ${currentStatus}` }
  }

  if (!canTransition(currentStatus, newStatus)) {
    const allowed = ALLOWED_TRANSITIONS[currentStatus] || []
    return {
      valid: false,
      error: `Invalid transition from ${currentStatus} to ${newStatus}. Allowed transitions: ${allowed.join(', ') || 'none (terminal state)'}`
    }
  }

  return { valid: true }
}

/**
 * 종료 상태인지 확인
 * @param {string} status - 상태
 * @returns {boolean}
 */
export function isTerminalState(status) {
  return !ALLOWED_TRANSITIONS[status]
}
