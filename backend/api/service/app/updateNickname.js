'use strict'

import { eq } from 'drizzle-orm'
import { sql } from '../../../lib/index.js'
import { logSuccess, logFailure } from '../../../service/audit.js'

const MAX_NICKNAME_LENGTH = 40

function buildUserResponse(user) {
  const identifierType = user?.identifierType || ''
  const identifierValue = user?.identifierValue || ''
  const email = identifierType === 'email' ? identifierValue : null
  const phone = identifierType === 'phone' ? identifierValue : null
  const nickname = user?.nickname || null
  const name = nickname || (email ? String(email).split('@')[0] : null)

  return {
    id: user.id,
    nickname,
    name,
    email,
    phone,
    status: user.status || null
  }
}

export function register(route) {
  route.post('/update-nickname', async (ctx) => {
    try {
      const profile = ctx.request.profile
      if (!profile?.id) {
        ctx.status = 401
        ctx.body = { error: 'unauthorized', error_description: 'JWT 토큰이 필요합니다.' }
        return
      }

      const body = ctx.request.body || {}
      if (typeof body.nickname !== 'string') {
        ctx.status = 400
        ctx.body = { error: 'invalid_request', error_description: 'nickname이 필요합니다.' }
        return
      }

      const nickname = body.nickname.trim()
      if (!nickname) {
        ctx.status = 400
        ctx.body = { error: 'invalid_request', error_description: 'nickname은 비워둘 수 없습니다.' }
        return
      }
      if (nickname.length > MAX_NICKNAME_LENGTH) {
        ctx.status = 400
        ctx.body = { error: 'invalid_request', error_description: `nickname은 ${MAX_NICKNAME_LENGTH}자 이하여야 합니다.` }
        return
      }

      const user = await sql.db
        .select()
        .from(sql.schema.users)
        .where(eq(sql.schema.users.id, profile.id))
        .limit(1)
        .get()

      if (!user || user.status !== 'ACTIVE') {
        ctx.status = 403
        ctx.body = { error: 'account_inactive', error_description: '사용자를 찾을 수 없거나 활성 상태가 아닙니다.' }
        return
      }

      const updated = await sql.db
        .update(sql.schema.users)
        .set({ nickname })
        .where(eq(sql.schema.users.id, profile.id))
        .returning()
        .get()

      ctx.body = await logSuccess(ctx, 'update_nickname', 'Nickname updated', {
        result: true,
        user: buildUserResponse(updated || { ...user, nickname })
      })
    } catch (e) {
      ctx.body = await logFailure(ctx, 'update_nickname', 'Nickname update failed', e)
    }
  })
}
