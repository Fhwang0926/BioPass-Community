'use strict'

import { pgTable, serial, integer, text, boolean, timestamp, index } from 'drizzle-orm/pg-core'

// Log Mail Table
export const logMail = pgTable('log_mail', {
  id: serial('id').primaryKey(),
  title: text('title').default(''),
  content: text('content').default(''),
  to: text('to').default(''),
  cc: text('cc').default(''),
  bcc: text('bcc').default(''),
  from: text('from').notNull(),
  fromName: text('from_name'),
  isDone: boolean('is_done').default(false),
  isClear: boolean('is_clear').default(false),
  isHtml: boolean('is_html').default(false),
  uuid: integer('uuid'),
  errorMsg: text('error_msg'),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  uuidIdx: index('idx_log_mail_uuid').on(table.uuid),
  isDoneClearIdx: index('idx_log_mail_is_done_clear').on(table.isDone, table.isClear)
}))
