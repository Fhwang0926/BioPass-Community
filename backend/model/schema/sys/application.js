'use strict'

import { pgTable, serial, integer, text, boolean, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core'
import { sysCompany } from './company.js'
import { sysUser } from './user.js'

// System Application Table
export const sysApplication = pgTable('sys_application', {
  id: serial('id').primaryKey(),
  isDel: boolean('is_del').default(false),
  isActive: boolean('is_active').default(true),
  name: text('name').notNull(),
  clientId: text('client_id').notNull(),
  clientSecret: text('client_secret').notNull(),
  callbackUrl: text('callback_url'),
  companyId: integer('company_id').references(() => sysCompany.id, { onDelete: 'set null' }),
  userId: integer('user_id').references(() => sysUser.id, { onDelete: 'set null' }),
  loginIdentifier: text('login_identifier').default('both'),
  authRequestExpiry: integer('auth_request_expiry').default(180),
  duplicateRequestLimit: integer('duplicate_request_limit').default(2),
  allowedCountries: text('allowed_countries'),
  lastAuthRequestAt: timestamp('last_auth_request_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  clientIdIdx: uniqueIndex('idx_sys_application_client_id').on(table.clientId),
  companyIdIdx: index('idx_sys_application_company_id').on(table.companyId),
  userIdIdx: index('idx_sys_application_user_id').on(table.userId),
  isActiveIdx: index('idx_sys_application_is_active').on(table.isActive)
}))
