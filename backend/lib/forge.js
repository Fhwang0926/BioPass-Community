'use strict'

import forge from 'node-forge'

/**
 * SHA-256 해시 (hex 문자열 반환)
 * @param {string} input - 해시할 문자열
 * @returns {string} hex 해시
 */
export function sha256Hex(input) {
  const md = forge.md.sha256.create()
  md.update(String(input), 'utf8')
  return forge.util.bytesToHex(md.digest().getBytes())
}

/**
 * HMAC-SHA256 서명 (hex 문자열 반환)
 * @param {string} key - HMAC 키
 * @param {string} input - 서명할 문자열
 * @returns {string} hex 서명
 */
export function hmacSha256Hex(key, input) {
  const hmac = forge.hmac.create()
  hmac.start('sha256', String(key))
  hmac.update(String(input), 'utf8')
  return forge.util.bytesToHex(hmac.digest().getBytes())
}

/**
 * 암호학적으로 안전한 랜덤 바이트를 hex 문자열로 반환
 * @param {number} byteCount - 바이트 수
 * @returns {string} hex 문자열
 */
export function randomBytesHex(byteCount) {
  const bytes = forge.random.getBytesSync(byteCount)
  return forge.util.bytesToHex(bytes)
}

/**
 * [min, max) 범위의 균등 분포 정수 (암호학적으로 안전)
 * @param {number} min - 최소값 (포함)
 * @param {number} max - 최대값 (미포함)
 * @returns {number}
 */
export function randomInt(min, max) {
  const range = max - min
  if (range <= 0) return min
  const n = parseInt(randomBytesHex(4), 16)
  return min + (n % range)
}
