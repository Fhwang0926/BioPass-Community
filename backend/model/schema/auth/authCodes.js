'use strict'

import { pgTable, text, bigint, index, uniqueIndex } from 'drizzle-orm/pg-core'
import { authRequests } from './authRequests.js'

const ts = (name) => bigint(name, { mode: 'number' })

// Auth Codes Table
export const authCodes = pgTable('app_auth_codes', {
  id: text('id').primaryKey(),
  authRequestId: text('auth_request_id').notNull().references(() => authRequests.id, { onDelete: 'cascade' }),
  codeHash: text('code_hash').notNull(),
  expiresAt: ts('expires_at').notNull(),
  consumedAt: ts('consumed_at'),
  createdAt: ts('created_at').notNull()
}, (table) => ({
  codeHashIdx: uniqueIndex('idx_app_auth_codes_code_hash').on(table.codeHash),
  authRequestIdIdx: index('idx_app_auth_codes_auth_request_id').on(table.authRequestId),
  expiresAtIdx: index('idx_app_auth_codes_expires_at').on(table.expiresAt)
}))
