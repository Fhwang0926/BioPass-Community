'use strict'

import { pgTable, text, bigint, boolean, index, uniqueIndex } from 'drizzle-orm/pg-core'

// 밀리초 타임스탬프(Date.now()) 저장 → integer(32bit) 범위 초과하므로 bigint 사용
const ts = (name) => bigint(name, { mode: 'number' })

// Devices Table
// device_id: 앱에서 전달한 기기 식별자 (iOS identifierForVendor, Android 등)
export const devices = pgTable('app_auth_devices', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  platform: text('platform').notNull(),
  deviceName: text('device_name'),
  deviceId: text('device_id'),
  pushToken: text('push_token').notNull(),
  deviceSecret: text('device_secret').notNull(),
  biometricCapable: boolean('biometric_capable').default(true),
  trustedUntil: ts('trusted_until'),
  revokedAt: ts('revoked_at'),
  lastSeenAt: ts('last_seen_at'),
  createdAt: ts('created_at').notNull()
}, (table) => ({
  userIdIdx: index('idx_app_auth_devices_user').on(table.userId),
  platformIdx: index('idx_app_auth_devices_platform').on(table.platform),
  revokedAtIdx: index('idx_app_auth_devices_revoked_at').on(table.revokedAt),
  userPushTokenIdx: uniqueIndex('idx_app_auth_devices_user_push_token').on(table.userId, table.pushToken)
}))
