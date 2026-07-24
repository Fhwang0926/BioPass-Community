'use strict'

import { eq, and, or, like, gte, lt, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import moment from 'moment-timezone'
import { Pool } from 'pg'
import config from '../config.js'
import * as schema from '../model/drizzle-schema.js'

/**
 * Drizzle 스키마에서 모든 테이블 이름을 자동으로 추출
 */
const getTableNamesFromSchema = () => {
  const tableNames = []
  const drizzleNameSymbol = Symbol.for('drizzle:Name')
  const drizzleBaseNameSymbol = Symbol.for('drizzle:BaseName')

  for (const key in schema) {
    const table = schema[key]
    if (table && typeof table === 'object' && table[Symbol.for('drizzle:IsDrizzleTable')]) {
      const tableName = table[drizzleNameSymbol] || table[drizzleBaseNameSymbol]
      if (tableName && typeof tableName === 'string') {
        tableNames.push(tableName)
      }
    }
  }
  return [...new Set(tableNames)]
}

let pool = null
let dbInstance = null

const getConnectionString = () => {
  if (config.db?.url) {
    return config.db.url
  }
  const host = config.db?.host || 'localhost'
  const port = config.db?.port || 5432
  const user = config.db?.user || 'postgres'
  const password = config.db?.pass || ''
  const database = config.db?.sid || config.db?.name || 'postgres'
  const encodedPassword = encodeURIComponent(password)
  return `postgresql://${user}:${encodedPassword}@${host}:${port}/${database}`
}

const connectionString = getConnectionString()

const open = async () => {
  if (pool && dbInstance) {
    return
  }

  console.log('[PostgreSQL] db connecting...')
  try {
    pool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000
    })

    dbInstance = drizzle(pool, { schema, logger: config.debug })

    const client = await pool.connect()
    try {
      const rs = await client.query('SELECT now() as current, current_setting(\'TIMEZONE\') as tz')
      const row = rs.rows[0]
      console.log(`DB - Current: ${row.current}, TimeZone: ${row.tz}`)
      console.log('[PostgreSQL] db connected')
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Unable to connect to the PostgreSQL database:', error)
    process.exit(1)
  }
}

const main = async () => {
  const scriptPath = process.argv[process.argv.length - 1] || ''
  const isDirectRun = scriptPath.endsWith('postgres.js') || scriptPath.endsWith('postgres')

  if (isDirectRun) {
    console.log('PostgreSQL test connection start')
    try {
      await open()
      const client = await pool.connect()
      const rs = await client.query('SELECT now() as current')
      client.release()
      console.log('PostgreSQL connection test result:', rs.rows[0])
      console.log('PostgreSQL test connection done')
      await close()
    } catch (e) {
      console.error('PostgreSQL connection test failed:', e)
      await close()
      process.exit(1)
    }
  } else {
    await open()
  }
}

/**
 * PostgreSQL에서 테이블 컬럼 목록 조회 (PRAGMA table_info 대체)
 * @param {string} tableName - 테이블 이름
 * @returns {Promise<Array<{name: string}>>}
 */
const getTableColumns = async (tableName) => {
  if (!dbInstance) return []
  const result = await dbInstance.execute(sql`
    SELECT column_name as name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ${tableName}
    ORDER BY ordinal_position
  `)
  return result.rows || []
}

const init = async (is_force) => {
  console.log(`PostgreSQL table force init : ${is_force}`)
  await open()

  try {
    const { execSync } = await import('child_process')
    const { fileURLToPath } = await import('url')
    const { dirname, join } = await import('path')

    const currentDir = dirname(fileURLToPath(import.meta.url))
    const backendDir = join(currentDir, '..')

    console.log('Drizzle Kit을 사용하여 테이블 및 인덱스 생성 중...')
    try {
      console.log('drizzle-kit push 실행 중...')
      execSync('npx drizzle-kit push --config=drizzle.config.cjs --force', {
        cwd: backendDir,
        stdio: 'pipe',
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024,
        timeout: 5 * 60 * 1000,
        env: { ...process.env, CI: '1' }
      })
      console.log('✅ 모든 테이블 및 인덱스 생성 완료')
    } catch (execError) {
      console.error('drizzle-kit push 실행 실패:', execError.message)
      console.log('💡 수동으로 실행: npm run db:push')
      throw execError
    }

    return true
  } catch (e) {
    throw e
  }
}

const truncateAllTables = async () => {
  const tableNames = getTableNamesFromSchema()
  const tableOrder = [...tableNames].sort().reverse()

  console.log(`🗑️  PostgreSQL 데이터 삭제: ${tableOrder.length}개 테이블`)

  const client = await pool.connect()
  try {
    await client.query('SET session_replication_role = replica')
    for (const tableName of tableOrder) {
      try {
        await client.query(`TRUNCATE TABLE "${tableName.replace(/"/g, '""')}" CASCADE`)
        console.log(`'${tableName}' 테이블 데이터 삭제 완료`)
      } catch (error) {
        console.error(`'${tableName}' 테이블 데이터 삭제 중 오류:`, error.message)
      }
    }
  } finally {
    await client.query('SET session_replication_role = DEFAULT')
    client.release()
  }
}

const buildSearchQuery = (option) => {
  const search = {}
  if (option.created_sd_at || option.created_ed_at) {
    search.created_at = {}
    if (option.created_sd_at) {
      search.created_at.gte = moment(option.created_sd_at, 'YYYY-MM-DD HH:mm:ss').toDate()
    }
    if (option.created_ed_at) {
      search.created_at.lt = moment(option.created_ed_at, 'YYYY-MM-DD HH:mm:ss').toDate()
    }
  }
  if (option.updated_sd_at || option.updated_ed_at) {
    search.updated_at = {}
    if (option.updated_sd_at) {
      search.updated_at.gte = moment(option.updated_sd_at, 'YYYY-MM-DD HH:mm:ss').toDate()
    }
    if (option.updated_ed_at) {
      search.updated_at.lt = moment(option.updated_ed_at, 'YYYY-MM-DD HH:mm:ss').toDate()
    }
  }
  return search
}

const backup = async () => {
  console.warn('[PostgreSQL] Backup: use pg_dump or Supabase dashboard.')
  return null
}

const optimize = async () => {
  try {
    const client = await pool.connect()
    try {
      await client.query('VACUUM ANALYZE')
    } finally {
      client.release()
    }
    console.log('PostgreSQL database optimized')
  } catch (error) {
    console.error('Optimization failed:', error)
    throw error
  }
}

const getStats = async () => {
  const tables = getTableNamesFromSchema()
  const stats = {
    connectionString: connectionString.replace(/:[^:@]+@/, ':****@'),
    tableCount: tables.length,
    tables: []
  }

  const client = await pool.connect()
  try {
    for (const table of tables) {
      try {
        const safeName = table.replace(/"/g, '""')
        const result = await client.query(`SELECT COUNT(*) as count FROM "${safeName}"`)
        const count = result.rows?.[0]?.count ?? 0
        stats.tables.push({ name: table, rowCount: Number(count) })
      } catch {
        stats.tables.push({ name: table, rowCount: -1 })
      }
    }
  } finally {
    client.release()
  }
  return stats
}

const close = async () => {
  try {
    if (pool) {
      await pool.end()
      pool = null
      dbInstance = null
      console.log('[PostgreSQL] Database connection closed')
    }
  } catch (error) {
    console.error('[PostgreSQL] Error closing database connection:', error)
    throw error
  }
}

/**
 * Drizzle pg 반환값은 배열인데, 기존 코드는 .get()으로 첫 행을 기대함.
 * select 체인 전체를 래핑해서 .get()(첫 행) / .all()(전체 배열)이 동작하도록 함.
 */
function wrapDbWithGet(db) {
  if (!db) return db
  function isQueryBuilderLike(obj) {
    return obj && typeof obj === 'object' && (
      typeof obj.execute === 'function' ||
      typeof obj.then === 'function' ||
      typeof obj.from === 'function' ||
      typeof obj.where === 'function' ||
      typeof obj.limit === 'function' ||
      typeof obj.values === 'function' ||
      typeof obj.set === 'function' ||
      typeof obj.returning === 'function'
    )
  }
  function addGetAndAll(q) {
    if (!q || typeof q !== 'object') return q
    if (typeof q.get === 'function' && typeof q.all === 'function') return q
    if (!isQueryBuilderLike(q)) return q
    return new Proxy(q, {
      get(target, prop) {
        if (prop === 'get') {
          return () => {
            if (typeof target.execute === 'function') {
              return target.execute().then(rows => (Array.isArray(rows) ? rows[0] : rows))
            }
            if (typeof target.then === 'function') {
              return target.then(rows => (Array.isArray(rows) ? rows[0] : rows))
            }
            return Promise.resolve(undefined)
          }
        }
        if (prop === 'all') {
          return () => {
            if (typeof target.execute === 'function') {
              return target.execute().then(rows => (Array.isArray(rows) ? rows : (rows ? [rows] : [])))
            }
            if (typeof target.then === 'function') {
              return target.then(rows => (Array.isArray(rows) ? rows : (rows ? [rows] : [])))
            }
            return Promise.resolve([])
          }
        }
        const v = target[prop]
        if (typeof v === 'function') {
          return function (...a) {
            return addGetAndAll(v.apply(target, a))
          }
        }
        return v
      }
    })
  }
  return new Proxy(db, {
    get(target, prop) {
      const v = target[prop]
      if (prop === 'select' || prop === 'insert' || prop === 'update' || prop === 'delete') {
        return function (...a) {
          return addGetAndAll(v.apply(target, a))
        }
      }
      return v
    }
  })
}

const __filename = new URL(import.meta.url).pathname
const isMainModule = process.argv[1] && process.argv[1].endsWith('postgres.js')

if (isMainModule) {
  main()
} else {
  open().catch(err => {
    console.error('Failed to auto-open database connection:', err)
  })
}

export default {
  get db() {
    return wrapDbWithGet(dbInstance)
  },
  getTableColumns,
  dbPath: connectionString,
  getDbPath: () => connectionString,
  schema,
  init,
  buildSearchQuery,
  truncateAllTables,
  backup,
  optimize,
  getStats,
  open,
  close,
  eq,
  and,
  or,
  like,
  gte,
  lt,
  sql
}
