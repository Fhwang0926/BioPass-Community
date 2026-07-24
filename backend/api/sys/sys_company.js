'use strict'

import { eq, and, or, like, ne, desc } from 'drizzle-orm'
import Router from 'koa-router'
import _ from 'lodash'
import { sql, func as _func } from '../../lib/index.js'
import { logSuccess, logFailure } from '../../service/audit.js'
import {
  createPermissionError,
  hasSystemAdminPermission,
  isSuperAdmin
} from '../../service/permission.js'
import { assertSameAdminCompany, getProfileCompanyId } from '../../service/serviceScope.js'

const route = new Router()

/** 시스템 관리 콘솔 전용 작업 — SUPER_ADMIN만 */
function assertSystemAdmin(ctx, action = 'manage companies') {
  if (!hasSystemAdminPermission(ctx.request.profile)) {
    throw createPermissionError(action)
  }
}

/** 자사 기업 조회 — SUPER_ADMIN은 전체, 그 외는 본인 companyId만 */
function assertCanReadCompany(ctx, companyId, action = 'read company') {
  if (isSuperAdmin(ctx.request.profile)) return
  const ownCompanyId = getProfileCompanyId(ctx.request.profile)
  if (!ownCompanyId || ownCompanyId !== companyId) {
    throw createPermissionError(action)
  }
}

function normalizeEmailValue(value) {
  const email = String(value || '').trim().toLowerCase()
  return email || null
}

// get search
route.post('/search', async (ctx) => {
  try {
    assertSystemAdmin(ctx, 'search companies')
    // 기본 검색 조건
    const conditions = [eq(sql.schema.sysCompany.isDel, false)]

    // 기타 검색 조건
    if (ctx.request.body.name) {
      conditions.push(like(sql.schema.sysCompany.name, `%${ctx.request.body.name}%`))
    }
    if (ctx.request.body.code) {
      conditions.push(like(sql.schema.sysCompany.code, `%${ctx.request.body.code}%`))
    }
    if (ctx.request.body.business_no) {
      conditions.push(like(sql.schema.sysCompany.businessNo, `%${ctx.request.body.business_no}%`))
    }
    if (ctx.request.body.email) {
      conditions.push(like(sql.schema.sysCompany.email, `%${ctx.request.body.email}%`))
    }
    if (ctx.request.body.is_active !== undefined) {
      conditions.push(eq(sql.schema.sysCompany.isActive, ctx.request.body.is_active))
    }

    const offset = ctx.request.body?.option?.offset || 0
    const limit = ctx.request.body?.option?.limit || 10
    const page = limit > 0 ? Math.floor(offset / limit) + 1 : 1

    // Count query
    const countResult = await sql.db.select({ count: sql.sql`count(*)` })
      .from(sql.schema.sysCompany)
      .where(and(...conditions))
      .get()
    const count = Number(countResult?.count ?? 0)

    // Select query
    const rows = await sql.db.select()
      .from(sql.schema.sysCompany)
      .where(and(...conditions))
      .orderBy(desc(sql.schema.sysCompany.createdAt))
      .limit(limit)
      .offset(offset)

    ctx.body = await logSuccess(ctx, 'company_search', 'Company search successful', {
      data: rows,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Number(limit > 0 ? Math.ceil(count / limit) : 0)
      }
    })
  } catch (e) {
    ctx.body = await logFailure(ctx, 'company_search', 'Company search failed', e)
  }
})

// insert one
route.post('/create', async (ctx) => {
  try {
    assertSystemAdmin(ctx, 'create company')
    const body = ctx.request.body

    // 필수 필드 검증
    if (!body.name) {
      ctx.throw(400, 'Company name is required')
    }

    // 사업자 번호 길이 검증 (최대 30자리)
    if (body.business_no && body.business_no.length > 30) {
      ctx.throw(400, 'Business registration number cannot exceed 30 characters')
    }

    // 중복 검사
    const conditions = []
    if (body.name) conditions.push(eq(sql.schema.sysCompany.name, body.name))
    if (body.code) conditions.push(eq(sql.schema.sysCompany.code, body.code))
    if (body.business_no) conditions.push(eq(sql.schema.sysCompany.businessNo, body.business_no))

    if (conditions.length > 0) {
      const existingCompany = await sql.db.select()
        .from(sql.schema.sysCompany)
        .where(or(...conditions))
        .limit(1)
        .get()

      if (existingCompany) {
        ctx.throw(400, 'Company with same name, code, or business number already exists')
      }
    }

    const companyEmail = normalizeEmailValue(body.email) || normalizeEmailValue(ctx.request.profile?.email)

    const company = await sql.db.insert(sql.schema.sysCompany).values({
      name: body.name,
      code: body.code,
      businessNo: body.business_no,
      thumbnail: body.thumbnail,
      email: companyEmail,
      isActive: body.is_active !== undefined ? body.is_active : true
    }).returning().get()

    ctx.body = await logSuccess(ctx, 'company_create', 'Company create successful', company)
  } catch (e) {
    ctx.body = await logFailure(ctx, 'company_create', 'Company create failed', e)
  }
})

// get one
route.get('/:id', async (ctx) => {
  try {
    const id = parseInt(ctx.params.id)
    if (!id) {
      ctx.throw(400, 'Company ID is required')
    }

    const company = await sql.db.select()
      .from(sql.schema.sysCompany)
      .where(and(
        eq(sql.schema.sysCompany.id, id),
        eq(sql.schema.sysCompany.isDel, false)
      ))
      .limit(1)
      .get()

    if (!company) {
      ctx.throw(404, 'Company not found')
    }

    assertCanReadCompany(ctx, id, 'read company')

    ctx.body = await logSuccess(ctx, 'company_get', 'Company get successful', company)
  } catch (e) {
    ctx.body = await logFailure(ctx, 'company_get', 'Company get failed', e)
  }
})

// update one
route.patch('/:id', async (ctx) => {
  try {
    const id = parseInt(ctx.params.id)
    const body = ctx.request.body

    if (!id) {
      ctx.throw(400, 'Company ID is required')
    }

    const company = await sql.db.select()
      .from(sql.schema.sysCompany)
      .where(and(
        eq(sql.schema.sysCompany.id, id),
        eq(sql.schema.sysCompany.isDel, false)
      ))
      .limit(1)
      .get()

    if (!company) {
      ctx.throw(404, 'Company not found')
    }

    const profile = ctx.request.profile
    const isSystemAdmin = isSuperAdmin(profile)
    if (!isSystemAdmin) {
      assertSameAdminCompany(profile, id, 'update company')
    }

    // 업데이트 가능한 필드만 선택
    const updateData = {}
    const selfServiceFields = ['name', 'code', 'business_no', 'thumbnail', 'email']
    const systemOnlyFields = ['is_active']
    const allowedFields = isSystemAdmin
      ? [...selfServiceFields, ...systemOnlyFields]
      : selfServiceFields

    allowedFields.forEach(field => {
      if (body[field] !== undefined && body[field] !== null && body[field] !== '') {
        // snake_case to camelCase conversion
        if (field === 'business_no') updateData.businessNo = body[field]
        else if (field === 'is_active') updateData.isActive = body[field]
        else updateData[field] = body[field]
      }
    })

    // 사업자 번호 길이 검증 (최대 30자리)
    if (updateData.businessNo && updateData.businessNo.length > 30) {
      ctx.throw(400, 'Business registration number cannot exceed 30 characters')
    }

    // 중복 검사
    if (updateData.name !== undefined && updateData.name !== company.name) {
      const existingCompany = await sql.db.select()
        .from(sql.schema.sysCompany)
        .where(and(
          ne(sql.schema.sysCompany.id, id),
          eq(sql.schema.sysCompany.name, updateData.name),
          eq(sql.schema.sysCompany.isDel, false)
        ))
        .limit(1)
        .get()

      if (existingCompany) {
        ctx.throw(400, 'Company with same name already exists')
      }
    }

    if (updateData.code !== undefined && updateData.code !== company.code) {
      const existingCompany = await sql.db.select()
        .from(sql.schema.sysCompany)
        .where(and(
          ne(sql.schema.sysCompany.id, id),
          eq(sql.schema.sysCompany.code, updateData.code),
          eq(sql.schema.sysCompany.isDel, false)
        ))
        .limit(1)
        .get()

      if (existingCompany) {
        ctx.throw(400, 'Company with same code already exists')
      }
    }

    if (updateData.businessNo !== undefined && updateData.businessNo !== company.businessNo) {
      const existingCompany = await sql.db.select()
        .from(sql.schema.sysCompany)
        .where(and(
          ne(sql.schema.sysCompany.id, id),
          eq(sql.schema.sysCompany.businessNo, updateData.businessNo),
          eq(sql.schema.sysCompany.isDel, false)
        ))
        .limit(1)
        .get()

      if (existingCompany) {
        ctx.throw(400, 'Company with same business number already exists')
      }
    }

    updateData.updatedAt = sql.sql`now()`

    const updatedCompany = await sql.db.update(sql.schema.sysCompany)
      .set(updateData)
      .where(eq(sql.schema.sysCompany.id, id))
      .returning()
      .get()

    ctx.body = await logSuccess(ctx, 'company_update', 'Company update successful', updatedCompany)
  } catch (e) {
    ctx.body = await logFailure(ctx, 'company_update', 'Company update failed', e)
  }
})

// remove one (soft delete)
route.delete('/:id', async (ctx) => {
  try {
    assertSystemAdmin(ctx, 'delete company')
    const id = parseInt(ctx.params.id)

    if (!id) {
      ctx.throw(400, 'Company ID is required')
    }

    const company = await sql.db.select()
      .from(sql.schema.sysCompany)
      .where(and(
        eq(sql.schema.sysCompany.id, id),
        eq(sql.schema.sysCompany.isDel, false)
      ))
      .limit(1)
      .get()

    if (!company) {
      ctx.throw(404, 'Company not found')
    }

    // 그룹과 관련된 사용자들도 함께 소프트 삭제
    await sql.db.update(sql.schema.sysUser)
      .set({
        isDel: true,
        updatedAt: sql.sql`now()`
      })
      .where(and(
        eq(sql.schema.sysUser.companyId, id),
        eq(sql.schema.sysUser.isDel, false)
      ))
      .returning()

    await sql.db.update(sql.schema.sysCompany)
      .set({
        isDel: true,
        updatedAt: sql.sql`now()`
      })
      .where(eq(sql.schema.sysCompany.id, id))
      .returning()

    ctx.body = await logSuccess(ctx, 'company_delete', 'Company delete successful', {})
  } catch (e) {
    ctx.body = await logFailure(ctx, 'company_delete', 'Company delete failed', e)
  }
})

export default { prefix: '/sys_company', route }
