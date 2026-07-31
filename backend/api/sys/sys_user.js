'use strict'

import { randomBytes } from 'node:crypto'
import { eq, and, like, ne, desc, or, sql as drizzleSql } from 'drizzle-orm'
import Router from 'koa-router'
import moment from 'moment-timezone'
import { sql, smtp } from '../../lib/index.js'
import { logSuccess, logFailure } from '../../service/audit.js'
import { hasUserManagementPermission, createPermissionError } from '../../service/permission.js'
import { hashPassword, isClientPasswordHash } from '../../util/password.js'
import { hashPhoneSha512 } from '../../util/phone.js'

const route = new Router()
const USER_MANAGED_PERMISSIONS = new Set(['USER', 'ADMIN'])

/**
 * 이메일 형식 검증
 * @param {string} email - 검증할 이메일 주소
 * @returns {boolean} 유효한 이메일 형식이면 true, 아니면 false
 */
const isValidEmail = (email) => {
  if (!email || typeof email !== 'string') {
    return false
  }

  // 이메일 정규식: 기본적인 이메일 형식 검증
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
  return emailRegex.test(email)
}

const normalizeEmail = (email) => String(email || '').trim().toLowerCase()

const parseCompanyId = (value) => {
  if (value === undefined || value === null || value === '') return null
  const companyId = Number(value)
  return Number.isInteger(companyId) && companyId > 0 ? companyId : null
}

const getProfileCompanyId = (profile) => parseCompanyId(profile?.companyId ?? profile?.company_id)

const getRequestCompanyId = (body = {}) => parseCompanyId(body.company_id ?? body.companyId)

const resolveTargetCompanyId = (profile, _requestedCompanyId = null) => {
  return getProfileCompanyId(profile)
}

const canManageCompanyUser = (profile, targetCompanyId) => {
  const profileCompanyId = getProfileCompanyId(profile)
  const parsedTargetCompanyId = parseCompanyId(targetCompanyId)
  return Boolean(
    profileCompanyId &&
    parsedTargetCompanyId &&
    profileCompanyId === parsedTargetCompanyId &&
    hasUserManagementPermission(profile, parsedTargetCompanyId)
  )
}

const normalizePermission = (permission, fallback = 'USER') => {
  const value = String(permission || fallback).trim().toUpperCase()
  return value || fallback
}

const toBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true') return true
    if (normalized === 'false') return false
  }
  return Boolean(value)
}

const resolveIsAdminFlag = (permission) => {
  const normalizedPermission = normalizePermission(permission)
  // Legacy SUPER_ADMIN counts as admin for last-admin guards
  return normalizedPermission === 'ADMIN' || normalizedPermission === 'SUPER_ADMIN'
}

const resolvePermission = (permission) => normalizePermission(permission)

const resolveUserManagedPermission = (ctx, permission) => {
  const normalizedPermission = resolvePermission(permission)
  if (normalizedPermission === 'SUPER_ADMIN') {
    ctx.throw(400, 'Invalid permissions')
  }
  if (!USER_MANAGED_PERMISSIONS.has(normalizedPermission)) {
    ctx.throw(400, 'Invalid permissions')
  }
  return normalizedPermission
}

/**
 * Block soft-deleting or demoting the last active console administrator.
 */
const assertNotLastActiveAdmin = async (ctx, user, { nextPermissions, nextIsActive, deleting } = {}) => {
  const currentPerm = normalizePermission(user?.permissions)
  const isCurrentlyAdmin = currentPerm === 'ADMIN' || currentPerm === 'SUPER_ADMIN'
  if (!isCurrentlyAdmin) return

  const willRemainAdmin = (() => {
    if (deleting) return false
    if (nextIsActive === false) return false
    if (nextPermissions !== undefined) {
      const next = normalizePermission(nextPermissions)
      return next === 'ADMIN' || next === 'SUPER_ADMIN'
    }
    return true
  })()
  if (willRemainAdmin) return

  const companyId = parseCompanyId(user.companyId)
  const conditions = [
    eq(sql.schema.sysUser.isDel, false),
    eq(sql.schema.sysUser.isActive, true),
    or(
      eq(sql.schema.sysUser.permissions, 'ADMIN'),
      eq(sql.schema.sysUser.permissions, 'SUPER_ADMIN'),
      eq(sql.schema.sysUser.permissions, 'admin'),
      eq(sql.schema.sysUser.permissions, 'super_admin')
    )
  ]
  if (companyId) {
    conditions.push(eq(sql.schema.sysUser.companyId, companyId))
  }

  const rows = await sql.db
    .select({ count: drizzleSql`count(*)::int` })
    .from(sql.schema.sysUser)
    .where(and(...conditions))
    .get()

  if (Number(rows?.count ?? 0) <= 1) {
    ctx.throw(400, 'Cannot remove or demote the last active administrator')
  }
}

const toClientUser = (user) => {
  if (!user) return user
  const { password: _password, ...safeUser } = user
  return {
    ...safeUser,
    phone_sha512: safeUser.phoneSha512 ?? safeUser.phone_sha512 ?? null,
    company_id: safeUser.companyId ?? safeUser.company_id ?? null,
    is_active: safeUser.isActive ?? safeUser.is_active ?? false,
    is_verify: safeUser.isVerify ?? safeUser.is_verify ?? false,
    isAdmin: resolveIsAdminFlag(safeUser.permissions),
    is_admin: resolveIsAdminFlag(safeUser.permissions),
    is_del: safeUser.isDel ?? safeUser.is_del ?? false,
    created_at: safeUser.createdAt ?? safeUser.created_at ?? null,
    updated_at: safeUser.updatedAt ?? safeUser.updated_at ?? null,
    last_visited_at: safeUser.lastVisitedAt ?? safeUser.last_visited_at ?? null
  }
}

const generateTemporaryPassword = () => randomBytes(12).toString('base64url')

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')

const getFrontendLoginUrl = (ctx) => {
  const origin = String(
    process.env.FRONTEND_ORIGIN ||
    process.env.PUBLIC_FRONTEND_ORIGIN ||
    process.env.PUBLIC_BASE_URL ||
    (process.env.NODE_ENV === 'production'
      ? `${ctx.request.protocol}://${ctx.request.host}`
      : 'http://localhost:3031')
  ).replace(/\/+$/, '')
  return `${origin}/#/login`
}

const sendInvitationEmail = async ({ ctx, email, name, company, temporaryPassword }) => {
  const signInUrl = getFrontendLoginUrl(ctx)
  const title = `[BioPass] ${company.name} 계정 초대`
  const safeEmail = escapeHtml(email)
  const safeName = escapeHtml(name || email)
  const safeCompanyName = escapeHtml(company.name)
  const safeTemporaryPassword = escapeHtml(temporaryPassword)
  const safeSignInUrl = escapeHtml(signInUrl)
  const content = JSON.stringify({
    type: 'company_invitation',
    company_id: company.id,
    company_name: company.name,
    email
  })
  const mailLog = await sql.db.insert(sql.schema.logMail).values({
    from: 'system',
    to: email,
    title,
    content,
    isHtml: true,
    isDone: false,
    isClear: false,
    createdAt: new Date(),
    updatedAt: new Date()
  }).returning().get()

  let sent = false
  let errorMsg = null
  try {
    if (smtp && typeof smtp.send === 'function') {
      await smtp.send({
        to: email,
        subject: title,
        html: `
          <p>${safeName}님, BioPass ${safeCompanyName} 회사 계정으로 초대되었습니다.</p>
          <p>아래 정보로 로그인한 뒤 비밀번호를 변경해 주세요.</p>
          <p><strong>로그인 이메일:</strong> ${safeEmail}</p>
          <p><strong>임시 비밀번호:</strong> ${safeTemporaryPassword}</p>
          <p><a href="${safeSignInUrl}">BioPass 로그인</a></p>
        `
      })
      sent = true
    }
  } catch (mailErr) {
    console.error('[sys_user] Invitation email send error:', mailErr)
    errorMsg = mailErr?.message || 'Email send failed'
  }

  if (mailLog?.id) {
    await sql.db.update(sql.schema.logMail)
      .set({
        isDone: sent,
        sentAt: sent ? new Date() : null,
        errorMsg,
        updatedAt: new Date()
      })
      .where(eq(sql.schema.logMail.id, mailLog.id))
  }

  return { sent, errorMsg, mailLogId: mailLog?.id ?? null }
}

/**
 * 사용자 검색 API
 */
route.post('/search', async (ctx) => {
  try {
    // 권한 검증: 조직 ADMIN
    if (!hasUserManagementPermission(ctx.request.profile)) {
      throw createPermissionError('search users')
    }

    // 검색 조건 빌드 — own company only
    const conditions = [eq(sql.schema.sysUser.isDel, false)]
    const profileCompanyId = getProfileCompanyId(ctx.request.profile)

    if (!profileCompanyId) {
      return ctx.throw(400, 'Company ID is required')
    }
    conditions.push(eq(sql.schema.sysUser.companyId, profileCompanyId))

    // 이메일 필터 (부분 일치)
    if (ctx.request.body?.email) {
      conditions.push(like(sql.schema.sysUser.email, `%${ctx.request.body.email}%`))
    }
    // 권한 필터 (정확히 일치)
    if (ctx.request.body?.permissions) {
      conditions.push(sql.sql`upper(${sql.schema.sysUser.permissions}) = ${normalizePermission(ctx.request.body.permissions)}`)
    }
    // 이름 필터 (부분 일치)
    if (ctx.request.body?.name) {
      conditions.push(like(sql.schema.sysUser.name, `%${ctx.request.body.name}%`))
    }
    if (ctx.request.body?.is_active !== undefined) {
      conditions.push(eq(sql.schema.sysUser.isActive, toBoolean(ctx.request.body.is_active)))
    }
    if (ctx.request.body?.is_verify !== undefined) {
      conditions.push(eq(sql.schema.sysUser.isVerify, toBoolean(ctx.request.body.is_verify)))
    }
    // 전화번호 필터: 평문 또는 SHA512 해시로 검색
    if (ctx.request.body?.phone) {
      const phoneHash = hashPhoneSha512(ctx.request.body.phone)
      if (phoneHash) {
        conditions.push(eq(sql.schema.sysUser.phoneSha512, phoneHash))
      } else {
        conditions.push(eq(sql.schema.sysUser.phone, ctx.request.body.phone))
      }
    }
    const offset = ctx.request.body?.option?.offset || 0
    const limit = ctx.request.body?.option?.limit || 10
    const page = limit > 0 ? Math.floor(offset / limit) + 1 : 1

    // Count query
    const countResult = await sql.db.select({ count: sql.sql`count(*)` })
      .from(sql.schema.sysUser)
      .where(and(...conditions))
      .get()
    const count = Number(countResult?.count ?? 0)

    // Select query (비밀번호 제외)
    const rows = await sql.db.select({
      id: sql.schema.sysUser.id,
      email: sql.schema.sysUser.email,
      name: sql.schema.sysUser.name,
      phone: sql.schema.sysUser.phone,
      phoneSha512: sql.schema.sysUser.phoneSha512,
      permissions: sql.schema.sysUser.permissions,
      companyId: sql.schema.sysUser.companyId,
      isActive: sql.schema.sysUser.isActive,
      isVerify: sql.schema.sysUser.isVerify,
      isAdmin: sql.schema.sysUser.isAdmin,
      isDel: sql.schema.sysUser.isDel,
      thumbnail: sql.schema.sysUser.thumbnail,
      createdAt: sql.schema.sysUser.createdAt,
      updatedAt: sql.schema.sysUser.updatedAt,
      lastVisitedAt: sql.schema.sysUser.lastVisitedAt
    })
      .from(sql.schema.sysUser)
      .where(and(...conditions))
      .orderBy(desc(sql.schema.sysUser.id))
      .limit(limit)
      .offset(offset)

    ctx.body = await logSuccess(ctx, 'user_search', 'User search successful', {
      data: rows.map(toClientUser),
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Number(limit > 0 ? Math.ceil(count / limit) : 0)
      }
    })
  } catch (e) {
    ctx.body = await logFailure(ctx, 'user_search', 'User search failed', e)
  }
})

/**
 * 사용자 생성 API
 */
route.post('/create', async (ctx) => {
  try {
    const body = ctx.request.body

    // 권한 검증: 같은 조직 ADMIN만 사용자 생성 가능
    const requestedCompanyId = getRequestCompanyId(body)
    const targetCompanyId = resolveTargetCompanyId(ctx.request.profile, requestedCompanyId)
    if (!targetCompanyId) {
      return ctx.throw(400, 'Company ID is required')
    }
    if (!canManageCompanyUser(ctx.request.profile, targetCompanyId)) {
      throw createPermissionError('create users')
    }

    // 필수 필드 검증
    if (!body.email) {
      return ctx.throw(400, 'Email is required')
    }
    if (!body.password) {
      return ctx.throw(400, 'Password is required')
    }

    // 이메일 형식 검증
    if (!isValidEmail(body.email)) {
      return ctx.throw(400, 'Invalid email format')
    }

    // 이메일 소문자 변환 (일관성 유지)
    body.email = body.email.toLowerCase().trim()

    // 이메일 중복 검사
    const existingUser = await sql.db.select()
      .from(sql.schema.sysUser)
      .where(eq(sql.schema.sysUser.email, body.email))
      .limit(1)
      .get()

    if (existingUser) {
      return ctx.throw(400, 'Email already exists')
    }

    const permissions = resolveUserManagedPermission(ctx, body.permissions)

    // 사용자 데이터 준비 (전화번호는 SHA512 해시로 함께 저장)
    const userData = {
      email: body.email,
      password: hashPassword(body.email, body.password, isClientPasswordHash(body.password)),
      name: body.name || body.email.split('@')[0],
      phone: body.phone,
      phoneSha512: hashPhoneSha512(body.phone) ?? undefined,
      permissions,
      companyId: targetCompanyId,
      isActive: toBoolean(body.is_active, true),
      isVerify: toBoolean(body.is_verify, false),
      isAdmin: resolveIsAdminFlag(permissions)
    }

    // 사용자 생성
    const user = await sql.db.insert(sql.schema.sysUser)
      .values(userData)
      .returning()
      .get()

    ctx.body = await logSuccess(ctx, 'user_create', 'User create successful', toClientUser(user))
  } catch (e) {
    ctx.body = await logFailure(ctx, 'user_create', 'User create failed', e)
  }
})

/**
 * 기업 사용자 초대 API
 */
route.post('/invite', async (ctx) => {
  try {
    const body = ctx.request.body
    const requestedCompanyId = getRequestCompanyId(body)
    const targetCompanyId = resolveTargetCompanyId(ctx.request.profile, requestedCompanyId)

    if (!targetCompanyId) {
      return ctx.throw(400, 'Company ID is required')
    }
    if (!canManageCompanyUser(ctx.request.profile, targetCompanyId)) {
      throw createPermissionError('invite users')
    }

    const email = normalizeEmail(body.email)
    if (!email) {
      return ctx.throw(400, 'Email is required')
    }
    if (!isValidEmail(email)) {
      return ctx.throw(400, 'Invalid email format')
    }

    const company = await sql.db.select({
      id: sql.schema.sysCompany.id,
      name: sql.schema.sysCompany.name,
      email: sql.schema.sysCompany.email
    })
      .from(sql.schema.sysCompany)
      .where(eq(sql.schema.sysCompany.id, targetCompanyId))
      .limit(1)
      .get()

    if (!company) {
      return ctx.throw(404, 'Company not found')
    }

    const existingUser = await sql.db.select()
      .from(sql.schema.sysUser)
      .where(eq(sql.schema.sysUser.email, email))
      .limit(1)
      .get()

    if (existingUser) {
      return ctx.throw(400, 'Email already exists')
    }

    const permissions = resolveUserManagedPermission(ctx, body.permissions)
    const temporaryPassword = generateTemporaryPassword()
    const userData = {
      email,
      password: hashPassword(email, temporaryPassword),
      name: body.name || email.split('@')[0],
      phone: body.phone,
      phoneSha512: hashPhoneSha512(body.phone) ?? undefined,
      permissions,
      companyId: targetCompanyId,
      isActive: true,
      isVerify: true,
      isAdmin: resolveIsAdminFlag(permissions)
    }

    const user = await sql.db.insert(sql.schema.sysUser)
      .values(userData)
      .returning()
      .get()

    const invitation = await sendInvitationEmail({
      ctx,
      email,
      name: userData.name,
      company,
      temporaryPassword
    })

    ctx.body = await logSuccess(ctx, 'user_invite', 'User invitation successful', {
      user: toClientUser(user),
      invitation: {
        email_sent: invitation.sent,
        mail_log_id: invitation.mailLogId,
        error: invitation.errorMsg,
        ...(process.env.NODE_ENV !== 'production' ? { temporary_password: temporaryPassword } : {})
      }
    })
  } catch (e) {
    ctx.body = await logFailure(ctx, 'user_invite', 'User invitation failed', e)
  }
})

/**
 * 사용자 단일 조회 API
 */
route.get('/:id', async (ctx) => {
  try {
    // 권한 검증: 조직 ADMIN
    if (!hasUserManagementPermission(ctx.request.profile)) {
      throw createPermissionError('view user details')
    }

    // 파라미터 검증
    if (!ctx.params.id) {
      return ctx.throw(400, 'User ID is required')
    }

    // 사용자 조회 (비밀번호 필드 제외)
    const user = await sql.db.select({
      id: sql.schema.sysUser.id,
      email: sql.schema.sysUser.email,
      name: sql.schema.sysUser.name,
      phone: sql.schema.sysUser.phone,
      phoneSha512: sql.schema.sysUser.phoneSha512,
      permissions: sql.schema.sysUser.permissions,
      companyId: sql.schema.sysUser.companyId,
      isActive: sql.schema.sysUser.isActive,
      isVerify: sql.schema.sysUser.isVerify,
      isAdmin: sql.schema.sysUser.isAdmin,
      isDel: sql.schema.sysUser.isDel,
      thumbnail: sql.schema.sysUser.thumbnail,
      createdAt: sql.schema.sysUser.createdAt,
      updatedAt: sql.schema.sysUser.updatedAt,
      lastVisitedAt: sql.schema.sysUser.lastVisitedAt
    })
      .from(sql.schema.sysUser)
      .where(eq(sql.schema.sysUser.id, parseInt(ctx.params.id)))
      .limit(1)
      .get()

    if (!user) {
      return ctx.throw(404, 'User not found')
    }

    if (!canManageCompanyUser(ctx.request.profile, user.companyId)) {
      throw createPermissionError('view user details')
    }

    ctx.body = await logSuccess(ctx, 'user_get', 'User get successful', toClientUser(user))
  } catch (e) {
    ctx.body = await logFailure(ctx, 'user_get', 'User get failed', e)
  }
})

/**
 * 사용자 정보 수정 API
 */
route.patch('/:id', async (ctx) => {
  try {
    const body = ctx.request.body
    const userId = parseInt(ctx.params.id)

    // 사용자 조회
    const user = await sql.db.select()
      .from(sql.schema.sysUser)
      .where(eq(sql.schema.sysUser.id, userId))
      .limit(1)
      .get()

    if (!user) {
      return ctx.throw(404, 'User not found')
    }

    // 권한 검증: 같은 조직 ADMIN만 수정 가능
    if (!canManageCompanyUser(ctx.request.profile, user.companyId)) {
      throw createPermissionError('update users')
    }

    const nextPermissions = body.permissions !== undefined
      ? resolveUserManagedPermission(ctx, body.permissions)
      : undefined
    const nextIsActive = body.is_active !== undefined ? toBoolean(body.is_active, true) : undefined
    await assertNotLastActiveAdmin(ctx, user, { nextPermissions, nextIsActive })

    // 업데이트 데이터 준비
    const updateData = {}

    // 이메일 변경 시 검증
    if (body.email !== undefined) {
      if (body.email !== user.email) {
        if (!isValidEmail(body.email)) {
          return ctx.throw(400, 'Invalid email format')
        }
        body.email = body.email.toLowerCase().trim()

        // 이메일 중복 검사
        const existingUser = await sql.db.select()
          .from(sql.schema.sysUser)
          .where(and(
            eq(sql.schema.sysUser.email, body.email),
            ne(sql.schema.sysUser.id, userId)
          ))
          .limit(1)
          .get()

        if (existingUser) {
          return ctx.throw(400, 'Email already exists')
        }
        updateData.email = body.email
      }
    }

    // 허용된 필드 업데이트 (전화번호 변경 시 SHA512 해시도 갱신)
    if (body.permissions !== undefined) {
      updateData.permissions = resolveUserManagedPermission(ctx, body.permissions)
      updateData.isAdmin = resolveIsAdminFlag(updateData.permissions)
    }
    if (body.name !== undefined) updateData.name = body.name
    if (body.company_id !== undefined) {
      const targetCompanyId = getRequestCompanyId(body)
      if (!targetCompanyId) {
        return ctx.throw(400, 'Company ID is required')
      }
      if (!canManageCompanyUser(ctx.request.profile, targetCompanyId)) {
        throw createPermissionError('update users')
      }
      updateData.companyId = targetCompanyId
    }
    if (body.phone !== undefined) {
      updateData.phone = body.phone
      updateData.phoneSha512 = hashPhoneSha512(body.phone) ?? null
    }
    if (body.is_active !== undefined) updateData.isActive = toBoolean(body.is_active, true)

    // 비밀번호 변경 처리
    if (body.new_password) {
      const emailForHash = updateData.email || user.email
      updateData.password = hashPassword(emailForHash, body.new_password, isClientPasswordHash(body.new_password))
    }

    // updatedAt 업데이트
    updateData.updatedAt = sql.sql`now()`

    // 사용자 정보 업데이트
    const updatedUser = await sql.db.update(sql.schema.sysUser)
      .set(updateData)
      .where(eq(sql.schema.sysUser.id, userId))
      .returning()
      .get()

    ctx.body = await logSuccess(ctx, 'user_update', 'User update successful', toClientUser(updatedUser))
  } catch (e) {
    ctx.body = await logFailure(ctx, 'user_update', 'User update failed', e)
  }
})

/**
 * 사용자 삭제 API (소프트 삭제)
 */
route.delete('/:id', async (ctx) => {
  try {
    const userId = parseInt(ctx.params.id)

    // 삭제되지 않은 사용자 조회
    const user = await sql.db.select()
      .from(sql.schema.sysUser)
      .where(and(
        eq(sql.schema.sysUser.id, userId),
        eq(sql.schema.sysUser.isDel, false)
      ))
      .limit(1)
      .get()

    if (!user) {
      return ctx.throw(404, 'User not found or already deleted')
    }

    await assertNotLastActiveAdmin(ctx, user, { deleting: true })

    // 권한 검증: 같은 조직 ADMIN만 삭제 가능
    if (!canManageCompanyUser(ctx.request.profile, user.companyId)) {
      throw createPermissionError('delete users')
    }

    // 소프트 삭제 처리 (이메일에 타임스탬프 추가로 재가입 가능)
    const timestamp = moment().valueOf()
    await sql.db.update(sql.schema.sysUser)
      .set({
        isDel: true,
        email: `${user.email}.${timestamp}`,
        updatedAt: sql.sql`now()`
      })
      .where(eq(sql.schema.sysUser.id, userId))
      .returning()

    ctx.body = await logSuccess(ctx, 'user_delete', 'User delete successful', {})
  } catch (e) {
    ctx.body = await logFailure(ctx, 'user_delete', 'User delete failed', e)
  }
})

export default { prefix: '/sys_user', route }
