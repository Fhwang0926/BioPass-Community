'use strict'

import forge from 'node-forge'

/**
 * 전화번호 SHA512 해시 (hex)
 * 조회·매칭용으로 동일 규칙 적용
 *
 * @param {string} phone - 평문 전화번호
 * @returns {string|null} SHA512 hex 또는 null
 */
export const hashPhoneSha512 = (phone) => {
  if (!phone || typeof phone !== 'string') return null
  const normalized = String(phone).trim()
  if (!normalized) return null
  return forge.md.sha512.create().update(normalized).digest().toHex()
}

export default hashPhoneSha512
