'use strict'

import { pgTable, text, integer, bigint, boolean, index } from 'drizzle-orm/pg-core'
import { sysApplication } from '../sys/application.js'
import { sysCompany } from '../sys/company.js'

// 밀리초 타임스탬프(Date.now()) 저장 → integer(32bit) 범위 초과하므로 bigint 사용
const ts = (name) => bigint(name, { mode: 'number' })

// Security Policies Table
export const securityPolicies = pgTable('app_service_security_policies', {
  id: text('id').primaryKey(),
  scope: text('scope').notNull().default('APP'),
  companyId: integer('company_id').references(() => sysCompany.id, { onDelete: 'cascade' }),
  appId: integer('app_id').references(() => sysApplication.id, { onDelete: 'cascade' }),
  policyType: text('policy_type').notNull(),
  threshold: integer('threshold'),
  windowSeconds: integer('window_seconds'),
  allowedCountries: text('allowed_countries'),
  enabled: boolean('enabled').default(true),
  createdAt: ts('created_at').notNull()
}, (table) => ({
  companyIdIdx: index('idx_app_service_security_policies_company_id').on(table.companyId),
  appIdIdx: index('idx_app_service_security_policies_app_id').on(table.appId),
  policyTypeIdx: index('idx_app_service_security_policies_policy_type').on(table.policyType),
  enabledIdx: index('idx_app_service_security_policies_enabled').on(table.enabled),
  scopeIdx: index('idx_app_service_security_policies_scope').on(table.scope)
}))
