'use strict'

import { eq, and, like, desc } from 'drizzle-orm'
import Router from 'koa-router'
import _ from 'lodash'
import { sql, func as _func } from '../../lib/index.js'
import { logSuccess, logFailure } from '../../service/audit.js'
import { isAdmin, createPermissionError } from '../../service/permission.js'

const route = new Router()

// camelCase를 snake_case로 변환하는 헬퍼 함수
const toSnakeCase = (obj) => {
  if (!obj || typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.map(toSnakeCase)

  return Object.keys(obj).reduce((result, key) => {
    const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase()
    result[snakeKey] = obj[key]
    return result
  }, {})
}

// get search
route.post('/search', async (ctx) => {
  try {
    if (!isAdmin(ctx.request.profile)) {
      throw createPermissionError('search mail logs')
    }
    const conditions = []

    // 메일 정보 검색
    if (ctx.request.body?.title) {
      conditions.push(like(sql.schema.logMail.title, `%${ctx.request.body.title}%`))
    }
    if (ctx.request.body?.content) {
      conditions.push(like(sql.schema.logMail.content, `%${ctx.request.body.content}%`))
    }
    if (ctx.request.body?.to) {
      conditions.push(like(sql.schema.logMail.to, `%${ctx.request.body.to}%`))
    }
    if (ctx.request.body?.cc) {
      conditions.push(like(sql.schema.logMail.cc, `%${ctx.request.body.cc}%`))
    }
    if (ctx.request.body?.bcc) {
      conditions.push(like(sql.schema.logMail.bcc, `%${ctx.request.body.bcc}%`))
    }
    if (ctx.request.body?.from) {
      conditions.push(like(sql.schema.logMail.from, `%${ctx.request.body.from}%`))
    }
    if (ctx.request.body?.from_name) {
      conditions.push(like(sql.schema.logMail.fromName, `%${ctx.request.body.from_name}%`))
    }

    // 발송 옵션 검색
    if (ctx.request.body?.is_done !== undefined) {
      conditions.push(eq(sql.schema.logMail.isDone, ctx.request.body.is_done))
    }
    if (ctx.request.body?.is_clear !== undefined) {
      conditions.push(eq(sql.schema.logMail.isClear, ctx.request.body.is_clear))
    }
    if (ctx.request.body?.is_html !== undefined) {
      conditions.push(eq(sql.schema.logMail.isHtml, ctx.request.body.is_html))
    }
    if (ctx.request.body?.uuid) {
      conditions.push(eq(sql.schema.logMail.uuid, ctx.request.body.uuid))
    }

    // 발송 결과 검색
    if (ctx.request.body?.error_msg) {
      conditions.push(like(sql.schema.logMail.errorMsg, `%${ctx.request.body.error_msg}%`))
    }

    const offset = ctx.request.body?.option?.offset || 0
    const limit = ctx.request.body?.option?.limit || 10
    const page = limit > 0 ? Math.floor(offset / limit) + 1 : 1

    // Count query
    const countResult = await sql.db.select({ count: sql.sql`count(*)` })
      .from(sql.schema.logMail)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .get()
    const count = Number(countResult?.count ?? 0)

    // Select query
    const rows = await sql.db.select()
      .from(sql.schema.logMail)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(sql.schema.logMail.createdAt))
      .limit(limit)
      .offset(offset)

    ctx.body = await logSuccess(ctx, 'mail_search', 'Mail logs search successful', {
      data: rows.map(toSnakeCase),
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Number(limit > 0 ? Math.ceil(count / limit) : 0)
      }
    })
  } catch (e) {
    ctx.body = await logFailure(ctx, 'mail_search', 'Mail logs search failed', e)
  }
})

// insert one
route.post('/create', async (ctx) => {
  try {
    if (!isAdmin(ctx.request.profile)) {
      throw createPermissionError('create mail logs')
    }
    const body = ctx.request.body

    if (!body.from) {
      ctx.body = await logFailure(ctx, 'mail_create', 'From email is required', 'From email is required')
      return
    }

    const mail = await sql.db.insert(sql.schema.logMail).values({
      from: body.from,
      fromName: body.from_name,
      to: body.to || '',
      cc: body.cc || '',
      bcc: body.bcc || '',
      title: body.title || '',
      content: body.content || '',
      isDone: body.is_done !== undefined ? body.is_done : false,
      isClear: body.is_clear !== undefined ? body.is_clear : false,
      isHtml: body.is_html !== undefined ? body.is_html : false,
      uuid: body.uuid,
      errorMsg: body.error_msg,
      sentAt: body.sent_at
    }).returning().get()

    ctx.body = await logSuccess(ctx, 'mail_create', 'Mail log created successfully', toSnakeCase(mail))
  } catch (e) {
    ctx.body = await logFailure(ctx, 'mail_create', 'Mail log creation failed', e)
  }
})

// get one
route.get('/:id', async (ctx) => {
  try {
    if (!isAdmin(ctx.request.profile)) {
      throw createPermissionError('read mail logs')
    }
    const id = parseInt(ctx.params.id)
    if (!id) {
      ctx.body = await logFailure(ctx, 'mail_get', 'Mail log ID is required', 'ID is required')
      return
    }

    const mail = await sql.db.select()
      .from(sql.schema.logMail)
      .where(eq(sql.schema.logMail.id, id))
      .limit(1)
      .get()

    if (!mail) {
      ctx.body = await logFailure(ctx, 'mail_get', 'Mail log not found', 'Mail log not found')
      return
    }

    ctx.body = await logSuccess(ctx, 'mail_get', 'Mail log retrieved successfully', toSnakeCase(mail))
  } catch (e) {
    ctx.body = await logFailure(ctx, 'mail_get', 'Failed to retrieve mail log', e)
  }
})

// update one
route.patch('/:id', async (ctx) => {
  try {
    if (!isAdmin(ctx.request.profile)) {
      throw createPermissionError('update mail logs')
    }
    const id = parseInt(ctx.params.id)
    const body = ctx.request.body

    if (!id) {
      ctx.body = await logFailure(ctx, 'mail_update', 'Mail log ID is required', 'ID is required')
      return
    }

    const mail = await sql.db.select()
      .from(sql.schema.logMail)
      .where(eq(sql.schema.logMail.id, id))
      .limit(1)
      .get()

    if (!mail) {
      ctx.body = await logFailure(ctx, 'mail_update', 'Mail log not found', 'Mail log not found')
      return
    }

    const updateData = {}
    const allowedFields = ['is_done', 'is_clear', 'is_html', 'error_msg', 'sent_at']

    for (const field of allowedFields) {
      if (body[field] !== undefined && body[field] !== null) {
        if (field === 'is_done') updateData.isDone = body[field]
        else if (field === 'is_clear') updateData.isClear = body[field]
        else if (field === 'is_html') updateData.isHtml = body[field]
        else if (field === 'error_msg') updateData.errorMsg = body[field]
        else if (field === 'sent_at') updateData.sentAt = body[field]
      }
    }

    updateData.updatedAt = sql.sql`now()`

    const updatedMail = await sql.db.update(sql.schema.logMail)
      .set(updateData)
      .where(eq(sql.schema.logMail.id, id))
      .returning()
      .get()

    ctx.body = await logSuccess(ctx, 'mail_update', 'Mail log updated successfully', toSnakeCase(updatedMail))
  } catch (e) {
    ctx.body = await logFailure(ctx, 'mail_update', 'Mail log update failed', e)
  }
})

// remove one
route.delete('/:id', async (ctx) => {
  try {
    ctx.body = await logFailure(ctx, 'mail_delete', 'Delete operation is not allowed', 'is_not_allowed')
  } catch (e) {
    ctx.body = await logFailure(ctx, 'mail_delete', 'Mail log deletion failed', e)
  }
})

export default { prefix: '/log_mail', route }
