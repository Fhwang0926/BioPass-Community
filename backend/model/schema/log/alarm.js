'use strict'

import { pgTable, serial, integer, text, boolean, timestamp, index } from 'drizzle-orm/pg-core'
import { sysCompany } from '../sys/company.js'
import { sysUser } from '../sys/user.js'

// Log Alarm Table
export const logAlarm = pgTable('log_alarm', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => sysUser.id, { onDelete: 'cascade' }),
  companyId: integer('company_id').references(() => sysCompany.id, { onDelete: 'set null' }),
  type: text('type').notNull().default('system'),
  title: text('title').notNull(),
  content: text('content').notNull(),
  priority: text('priority').notNull().default('medium'),
  isRead: boolean('is_read').default(false),
  readAt: timestamp('read_at', { withTimezone: true }),
  actionUrl: text('action_url'),
  actionText: text('action_text'),
  metadata: text('metadata'),
  isEmailSent: boolean('is_email_sent').default(false),
  emailSentAt: timestamp('email_sent_at', { withTimezone: true }),
  isPushSent: boolean('is_push_sent').default(false),
  pushSentAt: timestamp('push_sent_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  isDeleted: boolean('is_deleted').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  userIdIdx: index('idx_log_alarm_user_id').on(table.userId),
  companyIdIdx: index('idx_log_alarm_company_id').on(table.companyId),
  typeIdx: index('idx_log_alarm_type').on(table.type),
  priorityIdx: index('idx_log_alarm_priority').on(table.priority),
  isReadIdx: index('idx_log_alarm_is_read').on(table.isRead),
  createdAtIdx: index('idx_log_alarm_created_at').on(table.createdAt),
  expiresAtIdx: index('idx_log_alarm_expires_at').on(table.expiresAt)
}))
