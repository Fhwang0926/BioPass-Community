'use strict'

import { eq } from 'drizzle-orm'
import { sql } from '../../lib/index.js'
import { createUser } from './user.js'
import { syncSchemaFromModels } from './sync_schema.js'

/**
 * Active (non-deleted) console users count.
 */
export async function countConsoleUsers () {
  if (!sql.db) return 0
  const countResult = await sql.db
    .select({ count: sql.sql`count(*)::int` })
    .from(sql.schema.sysUser)
    .where(eq(sql.schema.sysUser.isDel, false))
    .get()
  return Number(countResult?.count ?? 0)
}

/**
 * All console users including soft-deleted (setup reopen guard).
 */
export async function countAllConsoleUsers () {
  if (!sql.db) return 0
  const countResult = await sql.db
    .select({ count: sql.sql`count(*)::int` })
    .from(sql.schema.sysUser)
    .get()
  return Number(countResult?.count ?? 0)
}

async function hasSetupLatch () {
  if (!sql.db || !sql.schema.sysBootstrap) return false
  try {
    const row = await sql.db
      .select({ id: sql.schema.sysBootstrap.id })
      .from(sql.schema.sysBootstrap)
      .where(eq(sql.schema.sysBootstrap.id, 1))
      .limit(1)
      .get()
    return Boolean(row)
  } catch {
    return false
  }
}

/**
 * True when the instance has never completed first-run setup.
 * Latch + any historical user (including soft-deleted) both close setup.
 */
export async function needsInitialSetup () {
  if (await hasSetupLatch()) return false
  return (await countAllConsoleUsers()) === 0
}

/**
 * Permanently mark bootstrap complete (idempotent).
 */
export async function markSetupCompleted () {
  if (!sql.db || !sql.schema.sysBootstrap) return
  const existing = await sql.db
    .select({ id: sql.schema.sysBootstrap.id })
    .from(sql.schema.sysBootstrap)
    .where(eq(sql.schema.sysBootstrap.id, 1))
    .limit(1)
    .get()
  if (existing) return
  await sql.db.insert(sql.schema.sysBootstrap).values({
    id: 1,
    completedAt: new Date()
  })
}

/**
 * Run fn under a Postgres session advisory lock (TOCTOU guard for setup).
 */
export async function withSetupLock (fn) {
  await sql.db.execute(sql.sql`SELECT pg_advisory_lock(87201401)`)
  try {
    return await fn()
  } finally {
    try {
      await sql.db.execute(sql.sql`SELECT pg_advisory_unlock(87201401)`)
    } catch {
      // ignore unlock errors
    }
  }
}

/**
 * PostgreSQL boot: sync schema from Drizzle models, then optionally seed admin.
 * Interactive installs leave users empty so the web setup wizard can create the first admin.
 */
export const ensureTablesAndDefaultUser = async () => {
  const db = sql.db
  if (!db) {
    return
  }

  try {
    if (process.env.SKIP_AUTO_SCHEMA_SYNC === '1' || process.env.SKIP_AUTO_MIGRATE === '1') {
      console.log('[Init] Schema sync skipped (SKIP_AUTO_SCHEMA_SYNC / SKIP_AUTO_MIGRATE).')
    } else {
      try {
        syncSchemaFromModels({ quiet: false })
        await sql.close()
        await sql.open()
      } catch (pushErr) {
        console.error('[Init] Schema sync failed:', pushErr?.message || pushErr)
        console.error('[Init] Manual recovery (from backend/): npm run db:push')
        throw pushErr
      }
    }

    // Drop legacy migration bookkeeping if present (no longer used).
    try {
      await db.execute(sql.sql`DROP TABLE IF EXISTS "node_schema_migrations"`)
    } catch {
      // ignore
    }

    // If any users exist historically, ensure latch is set so setup cannot reopen.
    if ((await countAllConsoleUsers()) > 0) {
      await markSetupCompleted()
      return
    }

    if (await hasSetupLatch()) {
      return
    }

    const email = (process.env.INIT_ADMIN_EMAIL || '').trim()
    const password = (process.env.INIT_ADMIN_PASSWORD || '').trim()
    if (email && password) {
      console.log('[Init] No users found. Seeding admin from INIT_ADMIN_* env...')
      await withSetupLock(async () => {
        if (!(await needsInitialSetup())) return
        await createUser({
          email,
          password,
          permissions: 'ADMIN',
          name: process.env.INIT_ADMIN_NAME || 'Admin',
          phone: process.env.INIT_ADMIN_PHONE || '',
          isActive: true,
          isVerify: true
        })
        await markSetupCompleted()
      })
      console.log('[Init] Admin seeded from environment.')
      return
    }

    console.log('[Init] No users found. Open the admin UI to complete initial setup.')
  } catch (e) {
    console.warn('[Init] ensureTablesAndDefaultUser failed:', e?.message || e)
    throw e
  }
}
