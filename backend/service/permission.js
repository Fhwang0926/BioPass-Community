'use strict'

/**
 * Community edition roles (single-organization self-host):
 * 1. ADMIN: organization admin — manage users/apps within own company
 * 2. USER: console user with limited access
 * 3. APP: mobile end-user identity (not a console role)
 *
 * Legacy DB value SUPER_ADMIN is normalized to ADMIN on read.
 */

export const ROLES = {
  ADMIN: 'ADMIN',
  USER: 'USER',
  APP: 'APP'
}

const LEGACY_SUPER_ADMIN = 'SUPER_ADMIN'

/**
 * @param {Object} profile - user profile
 * @returns {string|null} role (ADMIN, USER, APP)
 */
export const getUserRole = (profile) => {
  if (!profile) return null

  if (profile.permissions) {
    const upperPermission = String(profile.permissions).trim().toUpperCase()
    if (upperPermission === LEGACY_SUPER_ADMIN) {
      return ROLES.ADMIN
    }
    if (Object.values(ROLES).includes(upperPermission)) {
      return upperPermission
    }
  }

  return ROLES.USER
}

/**
 * @param {Object} profile
 * @returns {boolean}
 */
export const isAdmin = (profile) => getUserRole(profile) === ROLES.ADMIN

/**
 * @param {Object} profile
 * @returns {boolean}
 */
export const isUser = (profile) => {
  const role = getUserRole(profile)
  return role === ROLES.USER || role === ROLES.ADMIN
}

/**
 * @param {Object} profile
 * @returns {boolean}
 */
export const isApp = (profile) => getUserRole(profile) === ROLES.APP

/**
 * User-management permission within optional company scope.
 * @param {Object} profile
 * @param {number|null} targetCompanyId
 * @returns {boolean}
 */
export const hasUserManagementPermission = (profile, targetCompanyId = null) => {
  if (getUserRole(profile) !== ROLES.ADMIN) return false
  if (!targetCompanyId) return true
  return Number(profile.companyId) === Number(targetCompanyId)
}

/**
 * @param {Object} profile
 * @returns {boolean}
 */
export const hasServiceAccessPermission = (profile) => {
  const role = getUserRole(profile)
  return role === ROLES.ADMIN || role === ROLES.USER
}

/**
 * @param {Object} profile
 * @param {string} requiredRole - ADMIN | USER | APP
 * @param {Object} options
 * @param {number} [options.targetCompanyId]
 * @returns {boolean}
 */
export const checkPermission = (profile, requiredRole, options = {}) => {
  if (!profile) return false

  const userRole = getUserRole(profile)
  const required = String(requiredRole || '').toUpperCase()

  // Legacy requiredRole SUPER_ADMIN → treat as ADMIN requirement
  if (required === LEGACY_SUPER_ADMIN) {
    return userRole === ROLES.ADMIN
  }

  switch (required) {
    case ROLES.ADMIN:
      if (userRole !== ROLES.ADMIN) return false
      if (options.targetCompanyId) {
        return Number(profile.companyId) === Number(options.targetCompanyId)
      }
      return true

    case ROLES.USER:
      return userRole === ROLES.ADMIN || userRole === ROLES.USER

    case ROLES.APP:
      return userRole === ROLES.APP

    default:
      return false
  }
}

/**
 * @param {string} action
 * @returns {Error}
 */
export const createPermissionError = (action = 'perform this action') => {
  return new Error(`No permission allowed to ${action}`)
}
