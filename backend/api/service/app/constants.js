'use strict'

import { sha256Hex, randomBytesHex, randomInt } from '../../../lib/forge.js'

export const generateClientId = () => 'app_' + randomBytesHex(16)
export const generateClientSecret = () => 'secret_' + randomBytesHex(32)

export const hashCode = (input) => sha256Hex(String(input))

export function normalizeIdentifier(type, value) {
  if (!value || typeof value !== 'string') return ''
  const v = value.trim()
  if (type === 'email') return v.toLowerCase()
  if (type === 'phone') return v.replace(/\D/g, '')
  return v
}

export const generateVerificationCode = () => String(randomInt(100000, 1000000))

export const APP_SIGNUP_FROM = 'app_signup'
