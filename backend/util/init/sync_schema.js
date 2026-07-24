'use strict'

/**
 * Sync PostgreSQL schema from Drizzle models (drizzle-kit push).
 * Replaces historical SQL migration files for Community installs.
 *
 * Safety:
 * - Development: push with --force (interactive/local convenience).
 * - Production: push WITHOUT --force unless ALLOW_SCHEMA_FORCE=1.
 *   Destructive/data-loss prompts are avoided via CI=1; operators should
 *   set SKIP_AUTO_SCHEMA_SYNC=1 and run `yarn db:push` deliberately after upgrades.
 */

import { execSync } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BACKEND_DIR = path.resolve(__dirname, '../..')

/**
 * Apply current model/schema to the database (create/alter as needed).
 * @param {{ quiet?: boolean }} [options]
 */
export function syncSchemaFromModels (options = {}) {
  const { quiet = false } = options
  const isProd = process.env.NODE_ENV === 'production'
  const allowForce =
    process.env.ALLOW_SCHEMA_FORCE === '1' ||
    process.env.ALLOW_SCHEMA_FORCE === 'true' ||
    !isProd

  if (!quiet) {
    console.log(
      `[Init] Syncing database schema from Drizzle models (db:push${allowForce ? ' --force' : ''})...`
    )
    if (isProd && allowForce) {
      console.warn('[Init] ALLOW_SCHEMA_FORCE is enabled in production — schema changes may be destructive.')
    }
  }

  const forceFlag = allowForce ? ' --force' : ''
  execSync(`npx drizzle-kit push --config=drizzle.config.cjs${forceFlag}`, {
    cwd: BACKEND_DIR,
    stdio: quiet ? 'pipe' : 'inherit',
    shell: true,
    timeout: 5 * 60 * 1000,
    env: {
      ...process.env,
      CI: '1'
    }
  })

  if (!quiet) {
    console.log('[Init] Schema sync complete.')
  }
}
