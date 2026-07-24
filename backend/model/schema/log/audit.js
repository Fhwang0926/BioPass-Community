'use strict'

import { pgTable, serial, integer, text, timestamp, index } from 'drizzle-orm/pg-core'
import { sysUser } from '../sys/user.js'

// Log Audit Table
// user_id: 관리자(sys_user) id (integer). app_user_id: 앱 사용자(usr_xxx) id (text)
export const logAudit = pgTable('log_audit', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => sysUser.id, { onDelete: 'set null' }),
  appUserId: text('app_user_id'),
  action: text('action').notNull(),
  status: text('status').notNull(),
  description: text('description'),
  requestPath: text('request_path'),
  requestMethod: text('request_method'),
  requestBody: text('request_body'),
  responseBody: text('response_body'),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  responseTime: integer('response_time'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  userIdIdx: index('idx_log_audit_user_id').on(table.userId),
  appUserIdIdx: index('idx_log_audit_app_user_id').on(table.appUserId),
  actionIdx: index('idx_log_audit_action').on(table.action),
  statusIdx: index('idx_log_audit_status').on(table.status),
  createdAtIdx: index('idx_log_audit_created_at').on(table.createdAt)
}))
