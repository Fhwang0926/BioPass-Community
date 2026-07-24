'use strict'

import { eq, and } from 'drizzle-orm'
import { randomBytesHex, sha256Hex } from '../../lib/forge.js'
import { sql } from '../../lib/index.js'

export const PLACEHOLDER_APP_USER_ID = '0'
export const APP_SIGNUP_SOURCE = 'app_signup'
export const WEB_AUTH_SIGNUP_SOURCE = 'web_auth'

export const hashAppUserIdentifier = (input) => sha256Hex(String(input))

export async function ensurePlaceholderAppUser() {
  const placeholderUser = await sql.db
    .select({ id: sql.schema.users.id })
    .from(sql.schema.users)
    .where(eq(sql.schema.users.id, PLACEHOLDER_APP_USER_ID))
    .limit(1)
    .get()

  if (placeholderUser) return placeholderUser

  try {
    await sql.db
      .insert(sql.schema.users)
      .values({
        id: PLACEHOLDER_APP_USER_ID,
        identifierType: 'placeholder',
        identifierHash: hashAppUserIdentifier('placeholder'),
        status: 'ACTIVE',
        createdAt: Date.now()
      })
  } catch (err) {
    if (err?.code !== '23505') throw err
  }

  return { id: PLACEHOLDER_APP_USER_ID }
}

export async function findAppUserByIdentifier(identifierType, normalizedIdentifier) {
  if (!identifierType || !normalizedIdentifier) return null
  return sql.db
    .select()
    .from(sql.schema.users)
    .where(and(
      eq(sql.schema.users.identifierType, identifierType),
      eq(sql.schema.users.identifierHash, hashAppUserIdentifier(normalizedIdentifier))
    ))
    .limit(1)
    .get()
}

export async function ensureWebAuthEmailUser(normalizedEmail) {
  const existingUser = await findAppUserByIdentifier('email', normalizedEmail)
  if (existingUser) {
    const updateData = {}
    if (!existingUser.identifierValue) updateData.identifierValue = normalizedEmail
    if (!existingUser.signupSource) updateData.signupSource = WEB_AUTH_SIGNUP_SOURCE

    if (Object.keys(updateData).length > 0) {
      const updatedUser = await sql.db
        .update(sql.schema.users)
        .set(updateData)
        .where(eq(sql.schema.users.id, existingUser.id))
        .returning()
        .get()
        .catch(() => null)
      return updatedUser || { ...existingUser, ...updateData }
    }

    return existingUser
  }

  const userId = `usr_${Date.now()}_${randomBytesHex(8)}`
  try {
    return await sql.db
      .insert(sql.schema.users)
      .values({
        id: userId,
        identifierType: 'email',
        identifierHash: hashAppUserIdentifier(normalizedEmail),
        identifierValue: normalizedEmail,
        signupSource: WEB_AUTH_SIGNUP_SOURCE,
        status: 'ACTIVE',
        createdAt: Date.now()
      })
      .returning()
      .get()
  } catch (err) {
    if (err?.code !== '23505') throw err
    return findAppUserByIdentifier('email', normalizedEmail)
  }
}
