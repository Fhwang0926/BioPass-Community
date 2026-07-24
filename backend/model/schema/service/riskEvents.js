'use strict'

import { pgTable, text, integer, bigint, index } from 'drizzle-orm/pg-core'
import { authRequests } from '../auth/authRequests.js'

const ts = (name) => bigint(name, { mode: 'number' })

// Risk Events Table
export const riskEvents = pgTable('app_service_risk_events', {
  id: text('id').primaryKey(),
  authRequestId: text('auth_request_id').references(() => authRequests.id, { onDelete: 'set null' }),
  userId: text('user_id'),
  riskType: text('risk_type').notNull(),
  score: integer('score'),
  action: text('action'),
  createdAt: ts('created_at').notNull()
}, (table) => ({
  authRequestIdIdx: index('idx_app_service_risk_events_auth_request_id').on(table.authRequestId),
  userIdIdx: index('idx_app_service_risk_events_user_id').on(table.userId),
  riskTypeIdx: index('idx_app_service_risk_events_risk_type').on(table.riskType),
  createdAtIdx: index('idx_app_service_risk_events_created_at').on(table.createdAt)
}))
