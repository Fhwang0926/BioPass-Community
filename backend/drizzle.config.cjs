'use strict'

const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') })
require('dotenv').config({ path: path.resolve(__dirname, '.env'), override: true })

function getDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  const host = process.env.DB_HOST || 'localhost'
  const port = process.env.DB_PORT || 5432
  const user = process.env.DB_USER || 'biopass'
  const password = process.env.DB_PASS || 'biopass'
  const database = process.env.DB_NAME || 'biopass'
  const encodedPassword = encodeURIComponent(password)
  return `postgresql://${user}:${encodedPassword}@${host}:${port}/${database}`
}

/** Schema sync via `npm run db:push` (no SQL migration history in this edition). */
module.exports = {
  schema: './model/drizzle-schema.js',
  dialect: 'postgresql',
  dbCredentials: {
    url: getDatabaseUrl()
  }
}
