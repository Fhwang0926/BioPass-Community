'use strict'

import { eq, and, like, desc } from 'drizzle-orm'
import { sql } from '../../../lib/index.js'
import { logSuccess, logFailure } from '../../../service/audit.js'
import { hasServiceAccessPermission, createPermissionError } from '../../../service/permission.js'

export function register(route) {
  route.post('/search', async (ctx) => {
    try {
      if (!ctx.request.profile) {
        ctx.status = 401
        ctx.body = { error: 'unauthorized', error_description: '인증이 필요합니다.' }
        return
      }
      if (!hasServiceAccessPermission(ctx.request.profile)) {
        throw createPermissionError('list applications')
      }

      const body = ctx.request.body || {}
      const page = parseInt(body.page) || 1
      const limit = Math.min(parseInt(body.limit) || 20, 100)
      const offset = (page - 1) * limit
      const whereConditions = [eq(sql.schema.sysApplication.isDel, false)]
      if (body.name) whereConditions.push(like(sql.schema.sysApplication.name, `%${body.name}%`))
      if (body.client_id) whereConditions.push(like(sql.schema.sysApplication.clientId, `%${body.client_id}%`))
      if (body.is_active !== undefined) whereConditions.push(eq(sql.schema.sysApplication.isActive, body.is_active))

      const totalResult = await sql.db
        .select({ count: sql.sql`count(*)` })
        .from(sql.schema.sysApplication)
        .where(and(...whereConditions))
        .get()
      const total = Number(totalResult?.count ?? 0)

      const applications = await sql.db
        .select()
        .from(sql.schema.sysApplication)
        .where(and(...whereConditions))
        .orderBy(desc(sql.schema.sysApplication.createdAt))
        .limit(limit)
        .offset(offset)
        .all()

      const safeApplications = applications.map(app => {
        const { clientSecret: _clientSecret, ...safeApp } = app
        return safeApp
      })

      ctx.body = await logSuccess(ctx, 'application_search', 'Application search successful', {
        data: safeApplications,
        pagination: { page, limit, total, totalPages: Number(Math.ceil(total / limit)) }
      })
    } catch (e) {
      ctx.body = await logFailure(ctx, 'application_search', 'Application search failed', e)
    }
  })
}
