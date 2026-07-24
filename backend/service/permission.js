'use strict'

/**
 * 역할(Role) 정의
 * 1. SUPER_ADMIN: 최고 관리자, 모든 사용자 및 시스템 메뉴 접근 가능
 * 2. ADMIN: 기업의 최고 관리자, 기업에 속한 사용자 관리 가능, 서비스 이용 가능
 * 3. USER: 기업의 사용자, 다른 사용자 관리 X, 서비스 이용 가능
 * 4. APP: 앱을 통해 회원 가입한 사용자, 자기 인증한 히스토리 및 인증 앱과 연동하기 위해 가입
 */

export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  USER: 'USER',
  APP: 'APP'
}

/**
 * 사용자 프로필에서 역할 확인
 * @param {Object} profile - 사용자 프로필 객체
 * @returns {string} 역할 (SUPER_ADMIN, ADMIN, USER, APP)
 */
export const getUserRole = (profile) => {
  if (!profile) return null

  // permissions 필드를 우선적으로 확인
  if (profile.permissions) {
    const upperPermission = profile.permissions.toUpperCase()
    if (Object.values(ROLES).includes(upperPermission)) {
      return upperPermission
    }
  }

  // 기본값은 USER
  return ROLES.USER
}

/**
 * SUPER_ADMIN 권한 확인
 * @param {Object} profile - 사용자 프로필 객체
 * @returns {boolean}
 */
export const isSuperAdmin = (profile) => {
  return getUserRole(profile) === ROLES.SUPER_ADMIN
}

/**
 * ADMIN 권한 확인
 * @param {Object} profile - 사용자 프로필 객체
 * @returns {boolean}
 */
export const isAdmin = (profile) => {
  const role = getUserRole(profile)
  return role === ROLES.ADMIN || role === ROLES.SUPER_ADMIN
}

/**
 * USER 권한 확인
 * @param {Object} profile - 사용자 프로필 객체
 * @returns {boolean}
 */
export const isUser = (profile) => {
  const role = getUserRole(profile)
  return role === ROLES.USER || role === ROLES.ADMIN || role === ROLES.SUPER_ADMIN
}

/**
 * APP 권한 확인
 * @param {Object} profile - 사용자 프로필 객체
 * @returns {boolean}
 */
export const isApp = (profile) => {
  return getUserRole(profile) === ROLES.APP
}

/**
 * 시스템 관리 권한 확인 (SUPER_ADMIN만)
 * @param {Object} profile - 사용자 프로필 객체
 * @returns {boolean}
 */
export const hasSystemAdminPermission = (profile) => {
  return isSuperAdmin(profile)
}

/**
 * 사용자 관리 권한 확인 (SUPER_ADMIN 또는 ADMIN)
 * @param {Object} profile - 사용자 프로필 객체
 * @param {number} targetCompanyId - 대상 사용자의 companyId (선택적)
 * @returns {boolean}
 */
export const hasUserManagementPermission = (profile, targetCompanyId = null) => {
  const role = getUserRole(profile)

  // SUPER_ADMIN은 모든 사용자 관리 가능
  if (role === ROLES.SUPER_ADMIN) {
    return true
  }

  // ADMIN은 같은 기업의 사용자만 관리 가능
  if (role === ROLES.ADMIN) {
    // targetCompanyId가 없으면 자신의 기업 사용자 관리 가능
    if (!targetCompanyId) {
      return true
    }
    // 같은 기업인지 확인
    return profile.companyId === targetCompanyId
  }

  return false
}

/**
 * 서비스 이용 권한 확인 (SUPER_ADMIN, ADMIN, USER)
 * @param {Object} profile - 사용자 프로필 객체
 * @returns {boolean}
 */
export const hasServiceAccessPermission = (profile) => {
  const role = getUserRole(profile)
  return role === ROLES.SUPER_ADMIN || role === ROLES.ADMIN || role === ROLES.USER
}

/**
 * 권한 체크 미들웨어용 헬퍼
 * @param {Object} profile - 사용자 프로필 객체
 * @param {string} requiredRole - 필요한 역할 (SUPER_ADMIN, ADMIN, USER, APP)
 * @param {Object} options - 추가 옵션
 * @param {number} options.targetCompanyId - 대상 사용자의 companyId (ADMIN의 경우 같은 기업인지 확인)
 * @returns {boolean}
 */
export const checkPermission = (profile, requiredRole, options = {}) => {
  if (!profile) return false

  const userRole = getUserRole(profile)
  const required = requiredRole.toUpperCase()

  switch (required) {
    case ROLES.SUPER_ADMIN:
      return userRole === ROLES.SUPER_ADMIN

    case ROLES.ADMIN:
      // SUPER_ADMIN도 ADMIN 권한을 가짐
      if (userRole === ROLES.SUPER_ADMIN) return true
      if (userRole === ROLES.ADMIN) {
        // 같은 기업인지 확인 (옵션이 있는 경우)
        if (options.targetCompanyId) {
          return profile.companyId === options.targetCompanyId
        }
        return true
      }
      return false

    case ROLES.USER:
      // SUPER_ADMIN, ADMIN, USER 모두 USER 권한을 가짐
      return userRole === ROLES.SUPER_ADMIN || userRole === ROLES.ADMIN || userRole === ROLES.USER

    case ROLES.APP:
      return userRole === ROLES.APP

    default:
      return false
  }
}

/**
 * 권한 부족 에러 생성
 * @param {string} action - 수행하려던 작업
 * @returns {Error}
 */
export const createPermissionError = (action = 'perform this action') => {
  return new Error(`No permission allowed to ${action}`)
}
