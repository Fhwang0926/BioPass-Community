'use strict'

import { pgTable, integer, timestamp } from 'drizzle-orm/pg-core'

/**
 * Singleton latch: once initial console setup completes, setup stays closed
 * even if all console users are soft-deleted.
 */
export const sysBootstrap = pgTable('sys_bootstrap', {
  id: integer('id').primaryKey(),
  completedAt: timestamp('completed_at', { withTimezone: true }).notNull()
})
