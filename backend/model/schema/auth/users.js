'use strict'

import { pgTable, text, bigint, index, uniqueIndex } from 'drizzle-orm/pg-core'

// 밀리초 타임스탬프(Date.now()) 저장 → integer(32bit) 범위 초과하므로 bigint 사용
const ts = (name) => bigint(name, { mode: 'number' })

// Users Table (인증 대상 사용자)
// identifier_value: 이메일/연락처 원문(정규화). 표시·메일 발송용. 앱 가입 시 저장.
// nickname: 앱 사용자가 설정한 표시 이름. 외부 서비스의 사용자 name 응답에 우선 사용.
// signup_source: 가입 경로. 'app_signup' = 앱 회원가입, 'web_auth' 등. 관리 화면 사용자 목록은 app_signup만 표시.
export const users = pgTable('app_users', {
  id: text('id').primaryKey(),
  identifierType: text('identifier_type').notNull(),
  identifierHash: text('identifier_hash').notNull(),
  identifierValue: text('identifier_value'),
  nickname: text('nickname'),
  signupSource: text('signup_source'),
  status: text('status').default('ACTIVE'),
  lastLoginAt: ts('last_login_at'),
  createdAt: ts('created_at').notNull()
}, (table) => ({
  identifierTypeHashIdx: uniqueIndex('idx_app_users_identifier_type_hash').on(table.identifierType, table.identifierHash),
  identifierTypeIdx: index('idx_app_users_identifier_type').on(table.identifierType),
  identifierHashIdx: index('idx_app_users_identifier_hash').on(table.identifierHash),
  statusIdx: index('idx_app_users_status').on(table.status),
  signupSourceIdx: index('idx_app_users_signup_source').on(table.signupSource)
}))
