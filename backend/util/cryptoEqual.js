'use strict'

import crypto from 'crypto'

/**
 * Constant-time string equality for secrets (OAuth client_secret, etc.).
 * Returns false when either side is empty or lengths differ.
 */
export function timingSafeEqualString (a, b) {
  const left = Buffer.from(String(a ?? ''), 'utf8')
  const right = Buffer.from(String(b ?? ''), 'utf8')
  if (!left.length || left.length !== right.length) return false
  return crypto.timingSafeEqual(left, right)
}

export default timingSafeEqualString
