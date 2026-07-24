'use strict'

import { pgTable, text, bigint, index } from 'drizzle-orm/pg-core'
import { apps } from '../company.js'
import { users } from './users.js'

// 밀리초 단위 타임스탬프(JavaScript Date.now()) 저장 → PostgreSQL integer(32bit) 범위 초과하므로 bigint 사용
const ts = (name) => bigint(name, { mode: 'number' })

// Auth Requests Table
export const authRequests = pgTable('app_auth_requests', {
  id: text('id').primaryKey(),
  appId: text('app_id').notNull().references(() => apps.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  status: text('status').notNull(),
  requestIp: text('request_ip'),
  country: text('country'),
  userAgent: text('user_agent'),
  expiresAt: ts('expires_at'),
  approvedAt: ts('approved_at'),
  deniedAt: ts('denied_at'),
  consumedAt: ts('consumed_at'),
  createdAt: ts('created_at').notNull()
}, (table) => ({
  statusIdx: index('idx_app_auth_requests_status').on(table.status),
  createdAtIdx: index('idx_app_auth_requests_created_at').on(table.createdAt),
  appIdIdx: index('idx_app_auth_requests_app_id').on(table.appId),
  userIdIdx: index('idx_app_auth_requests_user_id').on(table.userId),
  expiresAtIdx: index('idx_app_auth_requests_expires_at').on(table.expiresAt)
}))
