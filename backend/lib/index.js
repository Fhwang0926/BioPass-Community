import func from './func.js'
import postgres from './postgres.js'
import smtp from './smtp.js'

// PostgreSQL 전용 (Drizzle + pg)
const sql = postgres
const common = { config: func.config }

export default {
  common, func, sql, postgres, smtp
}

export {
  common, func, sql, postgres, smtp
}
