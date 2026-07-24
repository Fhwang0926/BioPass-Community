'use strict'

import { pgTable, integer, bigint, text, index, uniqueIndex } from 'drizzle-orm/pg-core'
import { sysCompany } from './sys/company.js'

// 밀리초 타임스탬프(Date.now()) 저장 → integer(32bit) 범위 초과하므로 bigint 사용
const ts = (name) => bigint(name, { mode: 'number' })

// app_sys_apps: 앱(OAuth) 등록용
export const apps = pgTable('app_sys_apps', {
  id: text('id').primaryKey(),
  orgId: integer('org_id').notNull().references(() => sysCompany.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  clientId: text('client_id').notNull(),
  clientSecret: text('client_secret').notNull(),
  redirectUri: text('redirect_uri').notNull(),
  status: text('status').default('ACTIVE'),
  createdAt: ts('created_at').notNull()
}, (table) => ({
  clientIdIdx: uniqueIndex('idx_app_sys_apps_client_id').on(table.clientId),
  orgIdIdx: index('idx_app_sys_apps_org_id').on(table.orgId),
  statusIdx: index('idx_app_sys_apps_status').on(table.status)
}))
