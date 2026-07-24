'use strict'

import { pgTable, text, bigint, index } from 'drizzle-orm/pg-core'
import { authRequests } from './authRequests.js'

const ts = (name) => bigint(name, { mode: 'number' })

// Auth Events Table
export const authEvents = pgTable('app_auth_events', {
  id: text('id').primaryKey(),
  authRequestId: text('auth_request_id').notNull().references(() => authRequests.id, { onDelete: 'cascade' }),
  eventType: text('event_type').notNull(),
  detail: text('detail'),
  createdAt: ts('created_at').notNull()
}, (table) => ({
  authRequestIdIdx: index('idx_app_auth_events_request').on(table.authRequestId),
  eventTypeIdx: index('idx_app_auth_events_event_type').on(table.eventType),
  createdAtIdx: index('idx_app_auth_events_created_at').on(table.createdAt)
}))
