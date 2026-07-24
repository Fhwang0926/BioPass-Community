'use strict'

import { eq, and } from 'drizzle-orm'
import jwt from 'jsonwebtoken'
import config from '../../../config.js'
import { randomBytesHex } from '../../../lib/forge.js'
import { sql, smtp } from '../../../lib/index.js'
import { logSuccess, logFailure } from '../../../service/audit.js'
import { hashCode, normalizeIdentifier, generateVerificationCode, APP_SIGNUP_FROM } from './constants.js'

const DEVICE_PLATFORMS = ['ios', 'android', 'web']

// 인증 코드 만료 시간: 3분. 앱 코드 입력 화면의 카운트다운 타이머 및 이메일 안내 문구와 반드시 일치시켜야
// 한다. 표시된 만료 시간과 실제 검증 시간이 다르면 "타이머는 만료됐는데 코드는 통과"하는 불일치가 생긴다.
const SIGNUP_CODE_TTL_MS = 180 * 1000

/**
 * device body 파싱. push_token이 비어 있어도 platform이 유효하면 반환 (기기 등록 시 placeholder 사용).
 * @returns {{ platform, pushToken: string|null, deviceName, deviceId, biometricCapable } | null}
 */
function parseDeviceBody(body) {
  const raw = body.device
  if (!raw || typeof raw !== 'object') return null
  const platform = (raw.platform || '').toLowerCase()
  if (!DEVICE_PLATFORMS.includes(platform)) return null
  const pushTokenRaw = raw.push_token != null ? String(raw.push_token).trim() : ''
  const pushToken = pushTokenRaw || null
  const deviceId = raw.device_id != null ? String(raw.device_id).trim() : null
  return {
    platform,
    pushToken,
    deviceName: raw.device_name != null ? String(raw.device_name).trim() : null,
    deviceId: deviceId || null,
    biometricCapable: raw.biometric_capable !== false
  }
}

/** '365d', '7d', '6h' 등 만료 문자열을 초 단위로 변환 (expires_in 응답용) */
function parseExpiresToSeconds(expires) {
  if (!expires || typeof expires !== 'string') return 31536000
  const m = expires.trim().match(/^(\d+)([smhd])$/)
  if (!m) return 31536000
  const n = parseInt(m[1], 10)
  switch (m[2]) {
    case 's': return n
    case 'm': return n * 60
    case 'h': return n * 3600
    case 'd': return n * 86400
    default: return 31536000
  }
}

export function register(route) {
  route.post('/signup/send-code', async (ctx) => {
    try {
      const body = ctx.request.body || {}
      const identifierType = (body.identifier_type || '').toLowerCase()
      const identifierValue = body.identifier_value

      if (identifierType !== 'email' && identifierType !== 'phone') {
        ctx.status = 400
        ctx.body = { error: 'invalid_request', error_description: 'identifier_type은 "email" 또는 "phone"이어야 합니다.' }
        return
      }
      if (!identifierValue || typeof identifierValue !== 'string') {
        ctx.status = 400
        ctx.body = { error: 'invalid_request', error_description: 'identifier_value가 필요합니다.' }
        return
      }
      const normalized = normalizeIdentifier(identifierType, identifierValue)
      if (!normalized) {
        ctx.status = 400
        ctx.body = { error: 'invalid_request', error_description: '유효한 이메일 또는 연락처를 입력해 주세요.' }
        return
      }
      if (identifierType === 'phone' && normalized.length < 10) {
        ctx.status = 400
        ctx.body = { error: 'invalid_request', error_description: '연락처는 10자리 이상이어야 합니다.' }
        return
      }

      // 기존 사용자 여부 확인 → 이메일 내용 로그인/회원가입으로 분기
      const identifierHash = hashCode(normalized)
      const existingUser = await sql.db
        .select({ id: sql.schema.users.id })
        .from(sql.schema.users)
        .where(and(
          eq(sql.schema.users.identifierType, identifierType),
          eq(sql.schema.users.identifierHash, identifierHash)
        ))
        .limit(1)
        .get()
      const actionLabel = existingUser ? '로그인' : '회원가입'

      // 기존 미처리 코드 무효화
      await sql.db
        .update(sql.schema.logMail)
        .set({ uuid: 0, updatedAt: new Date() })
        .where(and(
          eq(sql.schema.logMail.from, APP_SIGNUP_FROM),
          eq(sql.schema.logMail.to, normalized),
          eq(sql.schema.logMail.isClear, false)
        ))

      const code = generateVerificationCode()
      const codeNum = parseInt(code, 10)
      const mailLog = await sql.db
        .insert(sql.schema.logMail)
        .values({
          from: APP_SIGNUP_FROM,
          to: normalized,
          title: `BioPass ${actionLabel} 인증 코드`,
          content: identifierType === 'email'
            ? `<p>BioPass ${actionLabel} 인증 코드입니다.</p><p><strong>${code}</strong></p><p>3분 이내에 입력해 주세요.</p>`
            : `BioPass ${actionLabel} 인증 코드: ${code} (3분 이내 입력)`,
          isHtml: identifierType === 'email',
          isDone: false,
          isClear: false,
          uuid: codeNum,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning()
        .get()

      if (identifierType === 'email') {
        let sent = false
        let errorMsg = null
        try {
          if (smtp && typeof smtp.send === 'function') {
            await smtp.send({
              to: normalized,
              subject: `BioPass ${actionLabel} 인증 코드`,
              html: `<p>BioPass ${actionLabel} 인증 코드입니다.</p><p><strong>${code}</strong></p><p>3분 이내에 입력해 주세요.</p>`
            })
            sent = true
          }
        } catch (mailErr) {
          console.error('App signup email send error:', mailErr)
          errorMsg = mailErr?.message || 'Email send failed'
        }
        if (mailLog?.id) {
          await sql.db
            .update(sql.schema.logMail)
            .set({ isDone: sent || config.debug, sentAt: sent ? new Date() : null, errorMsg, updatedAt: new Date() })
            .where(eq(sql.schema.logMail.id, mailLog.id))
        }
        if (!sent && config.debug) {
          console.log(`[App ${actionLabel}] Email verification code (dev only):`, code, 'for', normalized)
        }
      } else {
        if (mailLog?.id) {
          await sql.db
            .update(sql.schema.logMail)
            .set({ isDone: true, sentAt: new Date(), updatedAt: new Date() })
            .where(eq(sql.schema.logMail.id, mailLog.id))
        }
        if (config.debug) {
          console.log(`[App ${actionLabel}] Phone verification code (dev only):`, code, 'for', normalized)
        }
      }

      ctx.body = await logSuccess(ctx, 'signup_send_code', '인증 코드가 발송되었습니다.', {
        result: true,
        is_login: !!existingUser,
        message: identifierType === 'email' ? '인증 메일을 발송했습니다.' : '인증 메시지를 발송했습니다.'
      })
    } catch (e) {
      ctx.body = await logFailure(ctx, 'signup_send_code', '인증 코드 발송 실패', e)
    }
  })

  route.post('/signup/verify', async (ctx) => {
    try {
      const body = ctx.request.body || {}
      const identifierType = (body.identifier_type || '').toLowerCase()
      const identifierValue = body.identifier_value
      const code = body.code

      if (identifierType !== 'email' && identifierType !== 'phone') {
        ctx.status = 400
        ctx.body = { error: 'invalid_request', error_description: 'identifier_type은 "email" 또는 "phone"이어야 합니다.' }
        return
      }
      if (!identifierValue || !code) {
        ctx.status = 400
        ctx.body = { error: 'invalid_request', error_description: 'identifier_value와 code가 필요합니다.' }
        return
      }
      const normalized = normalizeIdentifier(identifierType, identifierValue)
      if (!normalized) {
        ctx.status = 400
        ctx.body = { error: 'invalid_request', error_description: '유효한 이메일 또는 연락처를 입력해 주세요.' }
        return
      }
      const codeNum = parseInt(String(code).trim(), 10)
      if (Number.isNaN(codeNum) || codeNum < 100000 || codeNum > 999999) {
        ctx.status = 400
        ctx.body = { error: 'invalid_request', error_description: '인증 코드는 6자리 숫자여야 합니다.' }
        return
      }

      const logRow = await sql.db
        .select()
        .from(sql.schema.logMail)
        .where(and(
          eq(sql.schema.logMail.from, APP_SIGNUP_FROM),
          eq(sql.schema.logMail.to, normalized),
          eq(sql.schema.logMail.uuid, codeNum),
          eq(sql.schema.logMail.isDone, true)
        ))
        .limit(1)
        .get()
      if (!logRow) {
        ctx.status = 400
        ctx.body = { error: 'invalid_code', error_description: '인증 코드가 올바르지 않거나 만료되었습니다.' }
        return
      }

      // 코드 발송 시각(createdAt) 기준 3분 경과 시 만료 처리. 앱 타이머/이메일 문구와 동일한 TTL을 강제해
      // 표시 시간과 실제 만료가 어긋나지 않도록 한다.
      const issuedAt = new Date(logRow.createdAt).getTime()
      if (Number.isNaN(issuedAt) || Date.now() - issuedAt > SIGNUP_CODE_TTL_MS) {
        ctx.status = 400
        ctx.body = { error: 'code_expired', error_description: '인증 코드가 만료되었습니다. 새 코드를 받아 다시 시도해 주세요.' }
        return
      }

      const identifierHash = hashCode(normalized)
      const alreadyUser = await sql.db
        .select()
        .from(sql.schema.users)
        .where(and(
          eq(sql.schema.users.identifierType, identifierType),
          eq(sql.schema.users.identifierHash, identifierHash)
        ))
        .limit(1)
        .get()

      let userId
      let successMessage

      console.log('[signup/verify] identifierType:', identifierType, '| normalized:', normalized, '| alreadyUser:', alreadyUser?.id ?? 'none')

      if (alreadyUser) {
        if (alreadyUser.status === 'INACTIVE') {
          ctx.status = 403
          ctx.body = { error: 'account_inactive', error_description: '비활성화된 계정입니다.' }
          return
        }
        userId = alreadyUser.id
        successMessage = '로그인 성공'
        await sql.db
          .update(sql.schema.users)
          .set({
            identifierValue: normalized,
            signupSource: APP_SIGNUP_FROM,
            lastLoginAt: Date.now()
          })
          .where(eq(sql.schema.users.id, userId))
          .catch(() => {})
      } else {
        userId = 'usr_' + randomBytesHex(12)
        successMessage = '회원가입이 완료되었습니다.'
        // onConflictDoUpdate: 동시 요청이나 조회-삽입 사이 race condition으로
        // 동일 identifier가 이미 존재하면 기존 사용자로 로그인 처리
        const inserted = await sql.db
          .insert(sql.schema.users)
          .values({
            id: userId,
            identifierType,
            identifierHash,
            identifierValue: normalized,
            signupSource: APP_SIGNUP_FROM,
            status: 'ACTIVE',
            lastLoginAt: Date.now(),
            createdAt: Date.now()
          })
          .onConflictDoUpdate({
            target: [sql.schema.users.identifierType, sql.schema.users.identifierHash],
            set: {
              identifierValue: normalized,
              signupSource: APP_SIGNUP_FROM,
              lastLoginAt: Date.now()
            }
          })
          .returning()
          .get()
        if (inserted && inserted.id !== userId) {
          // 기존 사용자가 존재하여 conflict 발생 → 기존 userId 사용
          userId = inserted.id
          successMessage = '로그인 성공'
        }
      }

      await sql.db
        .update(sql.schema.logMail)
        .set({ uuid: 0, isClear: true, updatedAt: new Date() })
        .where(eq(sql.schema.logMail.id, logRow.id))

      // 기기 등록을 토큰 발급 전에 수행 → 토큰 payload에 device_id 포함 가능
      // push_token이 비어 있으면 placeholder('pending_' + userId) 사용 → 나중에 실제 토큰으로 갱신 가능
      let registeredDevice = null
      const devicePayload = parseDeviceBody(body)
      if (devicePayload) {
        const now = Date.now()
        const effectivePushToken = devicePayload.pushToken || (`pending_${userId}`)
        let existing = null
        if (devicePayload.pushToken) {
          existing = await sql.db
            .select()
            .from(sql.schema.devices)
            .where(and(
              eq(sql.schema.devices.userId, userId),
              eq(sql.schema.devices.pushToken, devicePayload.pushToken)
            ))
            .limit(1)
            .get()
        } else if (devicePayload.deviceId) {
          existing = await sql.db
            .select()
            .from(sql.schema.devices)
            .where(and(
              eq(sql.schema.devices.userId, userId),
              eq(sql.schema.devices.deviceId, devicePayload.deviceId)
            ))
            .limit(1)
            .get()
        } else {
          existing = await sql.db
            .select()
            .from(sql.schema.devices)
            .where(and(
              eq(sql.schema.devices.userId, userId),
              eq(sql.schema.devices.pushToken, effectivePushToken)
            ))
            .limit(1)
            .get()
        }
        if (existing) {
          const updatePayload = {
            lastSeenAt: now,
            deviceName: devicePayload.deviceName || existing.deviceName,
            biometricCapable: devicePayload.biometricCapable,
            pushToken: effectivePushToken,
            revokedAt: null // 재로그인 시 revoke 해제
          }
          if (devicePayload.deviceId != null) updatePayload.deviceId = devicePayload.deviceId
          await sql.db
            .update(sql.schema.devices)
            .set(updatePayload)
            .where(eq(sql.schema.devices.id, existing.id))
          registeredDevice = {
            id: existing.id,
            device_id: devicePayload.deviceId ?? existing.deviceId,
            device_secret: existing.deviceSecret,
            platform: existing.platform,
            device_name: devicePayload.deviceName || existing.deviceName,
            push_token: devicePayload.pushToken ?? existing.pushToken,
            biometric_capable: devicePayload.biometricCapable,
            created_at: existing.createdAt,
            last_seen_at: now
          }
        } else {
          const devId = 'dev_' + randomBytesHex(12)
          const deviceSecret = 'secret_' + randomBytesHex(24)
          // onConflictDoUpdate: userId + pushToken 중복 시 기존 기기 업데이트
          const inserted = await sql.db
            .insert(sql.schema.devices)
            .values({
              id: devId,
              userId,
              platform: devicePayload.platform,
              deviceName: devicePayload.deviceName,
              deviceId: devicePayload.deviceId,
              pushToken: effectivePushToken,
              deviceSecret,
              biometricCapable: devicePayload.biometricCapable,
              lastSeenAt: now,
              createdAt: now
            })
            .onConflictDoUpdate({
              target: [sql.schema.devices.userId, sql.schema.devices.pushToken],
              set: {
                lastSeenAt: now,
                deviceName: devicePayload.deviceName,
                deviceId: devicePayload.deviceId,
                biometricCapable: devicePayload.biometricCapable,
                platform: devicePayload.platform
              }
            })
            .returning()
            .get()
          registeredDevice = {
            id: inserted?.id || devId,
            device_id: devicePayload.deviceId,
            device_secret: inserted?.deviceSecret || deviceSecret,
            platform: devicePayload.platform,
            device_name: devicePayload.deviceName,
            push_token: devicePayload.pushToken ?? effectivePushToken,
            biometric_capable: devicePayload.biometricCapable,
            created_at: inserted?.createdAt || now,
            last_seen_at: now
          }
        }
      }

      console.log('[signup/verify] userId:', userId, '| device:', registeredDevice?.id ?? 'none', '| pushToken:', registeredDevice?.push_token?.substring(0, 15) ?? 'none')
      const tokenDeviceId = registeredDevice?.device_id ?? null
      const accessPayload = {
        profile: {
          id: userId,
          identifierType,
          identifierHash,
          nickname: alreadyUser?.nickname || null,
          status: alreadyUser?.status || 'ACTIVE'
        }
      }
      if (tokenDeviceId != null) accessPayload.device_id = tokenDeviceId
      const accessToken = jwt.sign(
        accessPayload,
        config.auth.secret,
        { expiresIn: config.auth.accessApp }
      )
      const refreshPayload = { id: userId, type: 'refresh' }
      if (tokenDeviceId != null) refreshPayload.device_id = tokenDeviceId
      const refreshToken = jwt.sign(
        refreshPayload,
        config.auth.secret,
        { expiresIn: config.auth.refresh }
      )
      const accessExpiresInSeconds = parseExpiresToSeconds(config.auth.accessApp)

      const responseData = {
        result: true,
        user_id: userId,
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: accessExpiresInSeconds,
        refresh_token: refreshToken,
        message: successMessage
      }
      if (registeredDevice) {
        responseData.device = registeredDevice
      }

      ctx.body = await logSuccess(ctx, 'signup_verify', successMessage, responseData)
    } catch (e) {
      ctx.body = await logFailure(ctx, 'signup_verify', '회원가입 검증 실패', e)
    }
  })
}
