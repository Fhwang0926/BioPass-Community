'use strict'

import { pgTable, serial, integer, text, boolean, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core'
import { sysCompany } from './company.js'

// System User Table
export const sysUser = pgTable('sys_user', {
  id: serial('id').primaryKey(),
  isDel: boolean('is_del').default(false),
  isActive: boolean('is_active').default(true),
  isVerify: boolean('is_verify').default(false),
  isAdmin: boolean('is_admin').default(false),
  email: text('email').notNull(),
  password: text('password').notNull(),
  permissions: text('permissions').default('USER'),
  name: text('name').notNull(),
  phone: text('phone'),
  phoneSha512: text('phone_sha512'),
  thumbnail: text('thumbnail'),
  companyId: integer('company_id').references(() => sysCompany.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  lastVisitedAt: timestamp('last_visited_at', { withTimezone: true })
}, (table) => ({
  emailIdx: uniqueIndex('idx_sys_user_email').on(table.email),
  companyIdIdx: index('idx_sys_user_company_id').on(table.companyId),
  permissionsIdx: index('idx_sys_user_permissions').on(table.permissions)
}))
