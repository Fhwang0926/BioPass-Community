'use strict'

import { sql } from 'drizzle-orm'
import { pgTable, serial, text, boolean, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'

// System Company Table (조직)
export const sysCompany = pgTable('sys_company', {
  id: serial('id').primaryKey(),
  isDel: boolean('is_del').default(false),
  isActive: boolean('is_active').default(true),
  name: text('name').notNull(),
  code: text('code'),
  businessNo: text('business_no'),
  thumbnail: text('thumbnail'),
  email: text('email'),
  createdAt: timestamp('created_at', { withTimezone: true }).default(sql`now()`).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).default(sql`now()`).notNull(),
  lastVisitedAt: timestamp('last_visited_at', { withTimezone: true })
}, (table) => ({
  nameIdx: uniqueIndex('idx_sys_company_name').on(table.name),
  codeIdx: uniqueIndex('idx_sys_company_code').on(table.code),
  businessNoIdx: uniqueIndex('idx_sys_company_business_no').on(table.businessNo)
}))
