'use strict'

import { eq, and, like, desc, inArray, gte, lte } from 'drizzle-orm'
import Router from 'koa-router'
import _ from 'lodash'
import { sql, func as _func } from '../../lib/index.js'
import { logSuccess, logFailure } from '../../service/audit.js'
import { isAdmin } from '../../service/permission.js'

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
    const conditions = []

    // 액션 검색 (부분 일치)
    if (ctx.request.body?.action) {
      conditions.push(like(sql.schema.logAudit.action, `%${ctx.request.body.action}%`))
    }
    // 상태 검색
    if (ctx.request.body?.status) {
      conditions.push(eq(sql.schema.logAudit.status, ctx.request.body.status))
    }
    // 설명 검색
    if (ctx.request.body?.description) {
      conditions.push(like(sql.schema.logAudit.description, `%${ctx.request.body.description}%`))
    }
    // 요청 경로 검색
    if (ctx.request.body?.request_path) {
      conditions.push(like(sql.schema.logAudit.requestPath, `%${ctx.request.body.request_path}%`))
    }
    // 요청 메소드 검색
    if (ctx.request.body?.request_method) {
      conditions.push(eq(sql.schema.logAudit.requestMethod, ctx.request.body.request_method))
    }
    // IP 주소 검색
    if (ctx.request.body?.ip_address) {
      conditions.push(eq(sql.schema.logAudit.ipAddress, ctx.request.body.ip_address))
    }
    // User Agent 검색
    if (ctx.request.body?.user_agent) {
      conditions.push(like(sql.schema.logAudit.userAgent, `%${ctx.request.body.user_agent}%`))
    }

    // 응답 시간 범위 검색
    if (ctx.request.body?.response_time_min || ctx.request.body?.response_time_max) {
      const timeConditions = []
      if (ctx.request.body?.response_time_min) {
        timeConditions.push(gte(sql.schema.logAudit.responseTime, ctx.request.body.response_time_min))
      }
      if (ctx.request.body?.response_time_max) {
        timeConditions.push(lte(sql.schema.logAudit.responseTime, ctx.request.body.response_time_max))
      }
      if (timeConditions.length > 0) {
        conditions.push(and(...timeConditions))
      }
    }

    // 사용자 정보 검색
    if (ctx.request.body.user_id) {
      if (Array.isArray(ctx.request.body.user_id)) {
        conditions.push(inArray(sql.schema.logAudit.userId, ctx.request.body.user_id))
      } else {
        conditions.push(eq(sql.schema.logAudit.userId, ctx.request.body.user_id))
      }
    }

    const profile = ctx.request.profile
    // 관리자가 아니면 자신의 로그만 볼 수 있음
    if (!isAdmin(profile)) {
      conditions.push(eq(sql.schema.logAudit.userId, profile.id))
    }

    const offset = ctx.request.body?.option?.offset || 0
    const limit = ctx.request.body?.option?.limit || 10
    const page = limit > 0 ? Math.floor(offset / limit) + 1 : 1

    // Count query
    const countResult = await sql.db.select({ count: sql.sql`count(*)` })
      .from(sql.schema.logAudit)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .get()
    const count = Number(countResult?.count ?? 0)

    // Select query
    const rows = await sql.db.select()
      .from(sql.schema.logAudit)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(sql.schema.logAudit.createdAt))
      .limit(limit)
      .offset(offset)

    // 사용자 정보 추가 및 snake_case 변환
    const _rows = await Promise.all(rows.map(async (row) => {
      try {
        const user = row.userId ? await sql.db.select()
          .from(sql.schema.sysUser)
          .where(eq(sql.schema.sysUser.id, row.userId))
          .limit(1)
          .get() : null
        // snake_case로 변환
        const snakeCaseRow = toSnakeCase(row)
        return {
          ...snakeCaseRow,
          user: user ? toSnakeCase(user) : null
        }
      } catch (e) {
        console.error(e)
        return toSnakeCase(row)
      }
    }))

    ctx.body = await logSuccess(ctx, 'audit_search', 'Audit logs search successful', {
      data: _rows,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Number(limit > 0 ? Math.ceil(count / limit) : 0)
      }
    })
  } catch (e) {
    ctx.body = await logFailure(ctx, 'audit_search', 'Audit logs search failed', e)
  }
})

// insert one
route.post('/create', async (ctx) => {
  try {
    const body = ctx.request.body

    if (!body.action || !body.status) {
      ctx.body = await logFailure(ctx, 'audit_create', 'Action and status are required', 'Required fields missing')
      return
    }

    const audit = await sql.db.insert(sql.schema.logAudit).values({
      userId: ctx.request.profile?.id,
      action: body.action,
      status: body.status,
      description: body.description,
      requestPath: ctx.request.path,
      requestMethod: ctx.request.method,
      requestBody: typeof body.request_body === 'string' ? body.request_body : JSON.stringify(body.request_body || {}),
      responseBody: typeof body.response_body === 'string' ? body.response_body : JSON.stringify(body.response_body || {}),
      ipAddress: ctx.request.ip,
      userAgent: ctx.request.headers['user-agent'],
      responseTime: body.response_time
    }).returning().get()

    ctx.body = await logSuccess(ctx, 'audit_create', 'Audit log created successfully', toSnakeCase(audit))
  } catch (e) {
    ctx.body = await logFailure(ctx, 'audit_create', 'Audit log creation failed', e)
  }
})

// get one
route.get('/:id', async (ctx) => {
  try {
    const id = parseInt(ctx.params.id)
    if (!id) {
      ctx.body = await logFailure(ctx, 'audit_get', 'Audit log ID is required', 'ID is required')
      return
    }

    const audit = await sql.db.select()
      .from(sql.schema.logAudit)
      .where(eq(sql.schema.logAudit.id, id))
      .limit(1)
      .get()

    if (!audit) {
      ctx.body = await logFailure(ctx, 'audit_get', 'Audit log not found', 'Audit log not found')
      return
    }

    // 사용자 정보 추가 및 snake_case 변환
    const user = audit.userId ? await sql.db.select()
      .from(sql.schema.sysUser)
      .where(eq(sql.schema.sysUser.id, audit.userId))
      .limit(1)
      .get() : null

    // snake_case로 변환
    const data = {
      ...toSnakeCase(audit),
      user: user ? toSnakeCase(user) : null
    }

    ctx.body = await logSuccess(ctx, 'audit_get', 'Audit log retrieved successfully', data)
  } catch (e) {
    ctx.body = await logFailure(ctx, 'audit_get', 'Failed to retrieve audit log', e)
  }
})

// remove one
route.delete('/:id', async (ctx) => {
  try {
    ctx.body = await logFailure(ctx, 'audit_delete', 'Delete operation is not allowed', 'is_not_allowed')
  } catch (e) {
    ctx.body = await logFailure(ctx, 'audit_delete', 'Audit log deletion failed', e)
  }
})

export default { prefix: '/log_audit', route }
