'use strict'

import { eq, and, desc } from 'drizzle-orm'
import Router from 'koa-router'
import _ from 'lodash'
import { sql } from '../../lib/index.js'
import { logSuccess, logFailure } from '../../service/audit.js'
import { isSuperAdmin as _isSuperAdmin, getUserRole, ROLES, hasSystemAdminPermission, createPermissionError } from '../../service/permission.js'

const route = new Router()

/** 알림 단건 접근 권한 — search와 동일한 범위 적용 */
function assertCanAccessAlarm(profile, notification) {
  const userRole = getUserRole(profile)
  if (userRole === ROLES.SUPER_ADMIN) return
  if (userRole === ROLES.ADMIN) {
    if (notification.companyId === profile.companyId) return
    throw createPermissionError('access notification')
  }
  if (notification.userId === profile.id) return
  throw createPermissionError('access notification')
}

// 알림 목록(검색)
route.post('/search', async (ctx) => {
  try {
    const conditions = []
    const profile = ctx.request.profile || {}
    const userRole = getUserRole(profile)
    const isSystemAdmin = userRole === ROLES.SUPER_ADMIN
    const isGroupAdmin = userRole === ROLES.ADMIN

    if (isSystemAdmin) {
      // full access
    } else if (isGroupAdmin) {
      conditions.push(eq(sql.schema.logAlarm.companyId, profile.companyId))
    } else {
      conditions.push(eq(sql.schema.logAlarm.userId, profile.id))
    }

    // 기타 검색 조건
    if (ctx.request.body?.user_id) {
      conditions.push(eq(sql.schema.logAlarm.userId, ctx.request.body.user_id))
    }
    if (ctx.request.body?.company_id) {
      conditions.push(eq(sql.schema.logAlarm.companyId, ctx.request.body.company_id))
    }
    if (ctx.request.body?.type) {
      conditions.push(eq(sql.schema.logAlarm.type, ctx.request.body.type))
    }
    if (ctx.request.body?.is_read !== undefined) {
      conditions.push(eq(sql.schema.logAlarm.isRead, ctx.request.body.is_read))
    }
    if (ctx.request.body?.priority) {
      conditions.push(eq(sql.schema.logAlarm.priority, ctx.request.body.priority))
    }

    const offset = ctx.request.body?.option?.offset || 0
    const limit = ctx.request.body?.option?.limit || 10
    const page = limit > 0 ? Math.floor(offset / limit) + 1 : 1

    // Count query
    const countResult = await sql.db.select({ count: sql.sql`count(*)` })
      .from(sql.schema.logAlarm)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .get()
    const count = Number(countResult?.count ?? 0)

    // Select query
    const rows = await sql.db.select()
      .from(sql.schema.logAlarm)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(sql.schema.logAlarm.createdAt))
      .limit(limit)
      .offset(offset)

    ctx.body = await logSuccess(ctx, 'notification_search', 'Notification search successful', {
      data: rows,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Number(limit > 0 ? Math.ceil(count / limit) : 0)
      }
    })
  } catch (e) {
    ctx.body = await logFailure(ctx, 'notification_search', 'Notification search failed', e)
  }
})

// 알림 생성
route.post('/create', async (ctx) => {
  try {
    const profile = ctx.request.profile || {}
    if (!hasSystemAdminPermission(profile)) {
      throw createPermissionError('create notification')
    }
    const body = ctx.request.body
    if (!body.user_id || !body.title || !body.content) {
      ctx.throw(400, 'user_id, title, content are required')
    }

    const notification = await sql.db.insert(sql.schema.logAlarm).values({
      userId: body.user_id,
      companyId: body.company_id,
      type: body.type || 'system',
      title: body.title,
      content: body.content,
      priority: body.priority || 'medium',
      isRead: false,
      actionUrl: body.action_url,
      actionText: body.action_text,
      metadata: body.metadata ? JSON.stringify(body.metadata) : null,
      isEmailSent: false,
      isPushSent: false,
      isDeleted: false,
      expiresAt: body.expires_at
    }).returning().get()

    ctx.body = await logSuccess(ctx, 'notification_create', 'Notification create successful', notification)
  } catch (e) {
    ctx.body = await logFailure(ctx, 'notification_create', 'Notification create failed', e)
  }
})

// 알림 단건 조회
route.get('/:id', async (ctx) => {
  try {
    const id = parseInt(ctx.params.id)
    if (!id) ctx.throw(400, 'Notification ID is required')

    const notification = await sql.db.select()
      .from(sql.schema.logAlarm)
      .where(eq(sql.schema.logAlarm.id, id))
      .limit(1)
      .get()

    if (!notification) ctx.throw(404, 'Notification not found')

    assertCanAccessAlarm(ctx.request.profile || {}, notification)

    ctx.body = await logSuccess(ctx, 'notification_get', 'Notification get successful', notification)
  } catch (e) {
    ctx.body = await logFailure(ctx, 'notification_get', 'Notification get failed', e)
  }
})

// 알림 수정
route.patch('/:id', async (ctx) => {
  try {
    const id = parseInt(ctx.params.id)
    const body = ctx.request.body
    if (!id) ctx.throw(400, 'Notification ID is required')

    const notification = await sql.db.select()
      .from(sql.schema.logAlarm)
      .where(eq(sql.schema.logAlarm.id, id))
      .limit(1)
      .get()

    if (!notification) ctx.throw(404, 'Notification not found')

    assertCanAccessAlarm(ctx.request.profile || {}, notification)

    const updateData = {}
    const allowedFields = ['title', 'content', 'type', 'priority', 'is_read', 'read_at', 'expires_at', 'action_url', 'action_text', 'metadata', 'is_email_sent', 'is_push_sent']

    for (const field of allowedFields) {
      if (body[field] !== undefined && body[field] !== null) {
        // snake_case to camelCase
        if (field === 'is_read') updateData.isRead = body[field]
        else if (field === 'read_at') updateData.readAt = body[field]
        else if (field === 'expires_at') updateData.expiresAt = body[field]
        else if (field === 'action_url') updateData.actionUrl = body[field]
        else if (field === 'action_text') updateData.actionText = body[field]
        else if (field === 'is_email_sent') updateData.isEmailSent = body[field]
        else if (field === 'is_push_sent') updateData.isPushSent = body[field]
        else if (field === 'metadata') updateData.metadata = typeof body[field] === 'string' ? body[field] : JSON.stringify(body[field])
        else updateData[field] = body[field]
      }
    }

    updateData.updatedAt = sql.sql`now()`

    const updatedNotification = await sql.db.update(sql.schema.logAlarm)
      .set(updateData)
      .where(eq(sql.schema.logAlarm.id, id))
      .returning()
      .get()

    ctx.body = await logSuccess(ctx, 'notification_update', 'Notification update successful', updatedNotification)
  } catch (e) {
    ctx.body = await logFailure(ctx, 'notification_update', 'Notification update failed', e)
  }
})

// 알림 삭제
route.delete('/:id', async (ctx) => {
  try {
    ctx.body = await logFailure(ctx, 'notification_delete', 'Delete operation is not allowed', 'is_not_allowed')
  } catch (e) {
    ctx.body = await logFailure(ctx, 'notification_delete', 'Notification delete failed', e)
  }
})

export default { prefix: '/log_alarm', route }
