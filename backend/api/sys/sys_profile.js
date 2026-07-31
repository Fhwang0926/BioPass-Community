'use strict'

import { eq, and, or } from 'drizzle-orm'
import jwt from 'jsonwebtoken'
import Router from 'koa-router'
import { sql } from '../../lib/index.js'
import { logSuccess, logFailure } from '../../service/audit.js'
import { hasUserManagementPermission, createPermissionError } from '../../service/permission.js'
import { hashPassword, verifyPassword, isClientPasswordHash } from '../../util/password.js'
import { hashPhoneSha512 } from '../../util/phone.js'

const route = new Router()

// Helper functions
const getTokenFromHeader = (ctx) => {
  const bearer = ctx.request.header['authorization'] || ctx.request.header['Authorization']
  if (!bearer) {
    throw new Error('Authorization header is required')
  }
  return bearer.replace(/bearer /gi, '')
}

const verifyToken = (token) => {
  try {
    return jwt.verify(token, global.config.auth.secret).profile
  } catch (error) {
    throw new Error('Invalid token')
  }
}

// Get profile
route.get('/', async (ctx) => {
  try {
    const profile = ctx.request.profile

    if (!profile.id) {
      return ctx.throw(401, 'User not found')
    }

    const user = await sql.db.select({
      id: sql.schema.sysUser.id,
      email: sql.schema.sysUser.email,
      name: sql.schema.sysUser.name,
      phone: sql.schema.sysUser.phone,
      phoneSha512: sql.schema.sysUser.phoneSha512,
      thumbnail: sql.schema.sysUser.thumbnail,
      permissions: sql.schema.sysUser.permissions,
      companyId: sql.schema.sysUser.companyId,
      isVerify: sql.schema.sysUser.isVerify,
      createdAt: sql.schema.sysUser.createdAt,
      updatedAt: sql.schema.sysUser.updatedAt,
      lastVisitedAt: sql.schema.sysUser.lastVisitedAt
    })
      .from(sql.schema.sysUser)
      .where(and(
        eq(sql.schema.sysUser.id, profile.id),
        eq(sql.schema.sysUser.isDel, false)
      ))
      .limit(1)
      .get()

    if (!user) {
      return ctx.throw(404, 'User not found')
    }

    const company = await sql.db.select()
      .from(sql.schema.sysCompany)
      .where(and(
        eq(sql.schema.sysCompany.id, user.companyId),
        eq(sql.schema.sysCompany.isDel, false)
      ))
      .limit(1)
      .get()

    const userData = {
      ...user,
      company_id: user.companyId,
      group: {
        name: company ? company.name : null
      }
    }

    ctx.body = await logSuccess(ctx, 'profile_get', 'Profile get successful', userData)
  } catch (e) {
    ctx.body = await logFailure(ctx, 'profile_get', 'Profile get failed', e)
  }
})

// Update profile
route.post('/', async (ctx) => {
  try {
    const token = getTokenFromHeader(ctx)
    const updater = verifyToken(token)

    if (!updater.id) {
      return ctx.throw(401, 'User not found')
    }

    const profile = ctx.request.profile
    if (profile.id !== updater.id) {
      return ctx.throw(403, 'No permission to update this profile')
    }

    const user = await sql.db.select()
      .from(sql.schema.sysUser)
      .where(and(
        eq(sql.schema.sysUser.id, profile.id),
        eq(sql.schema.sysUser.isDel, false)
      ))
      .limit(1)
      .get()

    if (!user) {
      return ctx.throw(404, 'User not found')
    }

    const updateData = {}
    const allowedFields = ['name', 'phone']

    for (const field of allowedFields) {
      if (ctx.request.body[field] !== undefined) {
        updateData[field] = ctx.request.body[field]
      }
    }
    if (updateData.phone !== undefined) {
      updateData.phoneSha512 = hashPhoneSha512(updateData.phone) ?? null
    }

    // Handle password update
    if (ctx.request.body.password_new) {
      const current = ctx.request.body.password
      const next = ctx.request.body.password_new
      if (!current) {
        return ctx.throw(400, 'Current password is required')
      }
      const currentHashed = isClientPasswordHash(current)
      if (!verifyPassword(user.email, current, user.password, currentHashed)) {
        return ctx.throw(400, 'Invalid current password')
      }
      updateData.password = hashPassword(user.email, next, isClientPasswordHash(next))
    }

    // Update Company if provided
    if (ctx.request.body.company?.name) {
      await sql.db.update(sql.schema.sysCompany)
        .set({
          name: ctx.request.body.company.name,
          updatedAt: sql.sql`now()`
        })
        .where(eq(sql.schema.sysCompany.id, user.companyId))
        .returning()
    }

    updateData.updatedAt = sql.sql`now()`

    // Update user
    await sql.db.update(sql.schema.sysUser)
      .set(updateData)
      .where(eq(sql.schema.sysUser.id, profile.id))
      .returning()

    // Get updated user data
    const updatedUser = await sql.db.select({
      id: sql.schema.sysUser.id,
      email: sql.schema.sysUser.email,
      name: sql.schema.sysUser.name,
      phone: sql.schema.sysUser.phone,
      phoneSha512: sql.schema.sysUser.phoneSha512,
      thumbnail: sql.schema.sysUser.thumbnail,
      permissions: sql.schema.sysUser.permissions,
      companyId: sql.schema.sysUser.companyId,
      isVerify: sql.schema.sysUser.isVerify,
      createdAt: sql.schema.sysUser.createdAt,
      updatedAt: sql.schema.sysUser.updatedAt,
      lastVisitedAt: sql.schema.sysUser.lastVisitedAt
    })
      .from(sql.schema.sysUser)
      .where(eq(sql.schema.sysUser.id, profile.id))
      .limit(1)
      .get()

    ctx.body = await logSuccess(ctx, 'profile_update', 'Profile update successful', {
      ...updatedUser,
      company_id: updatedUser.companyId
    })
  } catch (e) {
    ctx.body = await logFailure(ctx, 'profile_update', 'Profile update failed', e)
  }
})

// Delete user (soft delete)
route.delete('/:id', async (ctx) => {
  try {
    const { id } = ctx.params
    const profile = ctx.request.profile
    const userId = parseInt(id)

    // 자신의 계정이거나 사용자 관리 권한이 있어야 함
    if (profile.id !== userId && !hasUserManagementPermission(profile)) {
      return ctx.throw(403, createPermissionError('delete this user').message)
    }

    const user = await sql.db.select()
      .from(sql.schema.sysUser)
      .where(and(
        eq(sql.schema.sysUser.id, userId),
        eq(sql.schema.sysUser.isDel, false)
      ))
      .limit(1)
      .get()

    if (!user) {
      return ctx.throw(404, 'User not found')
    }

    const perm = String(user.permissions || '').toUpperCase()
    if (perm === 'ADMIN' || perm === 'SUPER_ADMIN') {
      const companyId = user.companyId
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
        .select({ count: sql.sql`count(*)::int` })
        .from(sql.schema.sysUser)
        .where(and(...conditions))
        .get()
      if (Number(rows?.count ?? 0) <= 1) {
        return ctx.throw(400, 'Cannot delete the last active administrator')
      }
    }

    await sql.db.update(sql.schema.sysUser)
      .set({
        isDel: true,
        updatedAt: sql.sql`now()`
      })
      .where(eq(sql.schema.sysUser.id, userId))
      .returning()

    ctx.body = await logSuccess(ctx, 'profile_delete', 'User deleted successfully', {})
  } catch (e) {
    ctx.body = await logFailure(ctx, 'profile_delete', 'User delete failed', e)
  }
})

export default { prefix: '/sys_profile', route }
