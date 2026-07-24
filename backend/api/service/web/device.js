'use strict'

import { eq, and, isNull, isNotNull } from 'drizzle-orm'

function isUsablePushToken(userId, pushToken) {
  const token = typeof pushToken === 'string' ? pushToken.trim() : ''
  return Boolean(token && token !== `pending_${userId}`)
}

export async function hasRegisteredDevice(sql, userId) {
  if (!userId || !sql?.db || !sql?.schema?.devices) return false
  const row = await sql.db
    .select({ id: sql.schema.devices.id })
    .from(sql.schema.devices)
    .where(and(
      eq(sql.schema.devices.userId, userId),
      isNull(sql.schema.devices.revokedAt)
    ))
    .limit(1)
    .get()
  return Boolean(row?.id)
}

export async function hasRegisteredPushDevice(sql, userId) {
  if (!userId || !sql?.db || !sql?.schema?.devices) return false
  const rows = await sql.db
    .select({ pushToken: sql.schema.devices.pushToken })
    .from(sql.schema.devices)
    .where(and(
      eq(sql.schema.devices.userId, userId),
      isNull(sql.schema.devices.revokedAt),
      isNotNull(sql.schema.devices.pushToken)
    ))
    .limit(10)
  return rows.some((row) => isUsablePushToken(userId, row.pushToken))
}

/**
 * 이메일(identifierValue)로 등록된 디바이스가 있는지 확인.
 * 앱 가입 시 identifierType이 다를 수 있으므로 userId 대신 이메일로 조회.
 * @returns {{ found: boolean, userId: string|null }}
 */
export async function findUserWithDeviceByEmail(sql, email) {
  if (!email || !sql?.db) return { found: false, userId: null }
  const rows = await sql.db
    .select({ userId: sql.schema.devices.userId })
    .from(sql.schema.devices)
    .innerJoin(sql.schema.users, eq(sql.schema.devices.userId, sql.schema.users.id))
    .where(and(
      eq(sql.schema.users.identifierValue, email),
      isNull(sql.schema.devices.revokedAt)
    ))
    .limit(1)
  if (rows.length === 0) return { found: false, userId: null }
  return { found: true, userId: rows[0].userId }
}

export async function findUserWithPushDeviceByEmail(sql, email) {
  if (!email || !sql?.db) return { found: false, userId: null }
  const rows = await sql.db
    .select({
      userId: sql.schema.devices.userId,
      pushToken: sql.schema.devices.pushToken
    })
    .from(sql.schema.devices)
    .innerJoin(sql.schema.users, eq(sql.schema.devices.userId, sql.schema.users.id))
    .where(and(
      eq(sql.schema.users.identifierType, 'email'),
      eq(sql.schema.users.identifierValue, email),
      eq(sql.schema.users.status, 'ACTIVE'),
      isNull(sql.schema.devices.revokedAt),
      isNotNull(sql.schema.devices.pushToken)
    ))
    .limit(10)
  const row = rows.find((item) => isUsablePushToken(item.userId, item.pushToken))
  if (!row) return { found: false, userId: null }
  return { found: true, userId: row.userId }
}
