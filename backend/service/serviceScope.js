'use strict'

import { eq } from 'drizzle-orm'
import { sql } from '../lib/index.js'
import { createPermissionError, hasServiceAccessPermission, isAdmin, isSuperAdmin } from './permission.js'

const toPositiveInteger = (value) => {
  if (value === undefined || value === null || value === '') return null
  const parsed = Number.parseInt(String(value), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

export const getProfileCompanyId = (profile) => {
  return toPositiveInteger(profile?.companyId ?? profile?.company_id)
}

export const requireServiceCompanyScope = (profile, action = 'access service data') => {
  if (!hasServiceAccessPermission(profile)) {
    throw createPermissionError(action)
  }

  const companyId = getProfileCompanyId(profile)
  if (!companyId) {
    throw createPermissionError(`${action}: company scope is required`)
  }

  return companyId
}

export const assertSameServiceCompany = (profile, targetCompanyId, action = 'access service data') => {
  const companyId = requireServiceCompanyScope(profile, action)
  const parsedTargetCompanyId = toPositiveInteger(targetCompanyId)

  if (!parsedTargetCompanyId || parsedTargetCompanyId !== companyId) {
    throw createPermissionError(action)
  }

  return companyId
}

export const requireAdminCompanyScope = (profile, action = 'access company admin data') => {
  if (!isAdmin(profile)) {
    throw createPermissionError(action)
  }

  const companyId = getProfileCompanyId(profile)
  if (!companyId) {
    throw createPermissionError(`${action}: company scope is required`)
  }

  return companyId
}

export const assertSameAdminCompany = (profile, targetCompanyId, action = 'access company admin data') => {
  if (!isAdmin(profile)) {
    throw createPermissionError(action)
  }

  const parsedTargetCompanyId = toPositiveInteger(targetCompanyId)
  if (!parsedTargetCompanyId) {
    throw createPermissionError(action)
  }

  if (isSuperAdmin(profile)) {
    return parsedTargetCompanyId
  }

  const companyId = requireAdminCompanyScope(profile, action)
  if (companyId !== parsedTargetCompanyId) {
    throw createPermissionError(action)
  }

  return companyId
}

export const getCompanyAuthAppIds = async (companyId) => {
  if (!companyId) return []

  const rows = await sql.db
    .select({ id: sql.schema.apps.id })
    .from(sql.schema.apps)
    .where(eq(sql.schema.apps.orgId, companyId))
    .all()

  return rows.map((row) => row.id).filter(Boolean)
}
