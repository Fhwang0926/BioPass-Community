'use strict'

import crypto from 'crypto'
import forge from 'node-forge'

const SCRYPT_PREFIX = 'scrypt$'
const SCRYPT_N = 16384
const SCRYPT_R = 8
const SCRYPT_P = 1
const SCRYPT_KEYLEN = 64
const SCRYPT_SALT_BYTES = 16

/**
 * Detect frontend-prehashed passwords (SHA-512 hex of plaintext).
 */
export function isClientPasswordHash (password) {
  return typeof password === 'string' &&
    password.length === 128 &&
    /^[0-9a-f]{128}$/i.test(password)
}

function sha512Hex (value) {
  // Intentional: first-pass material only. Stored passwords use scrypt (see hashPassword).
  // codeql[js/insufficient-password-hash]
  // codeql[js/weak-cryptographic-algorithm]
  return forge.md.sha512.create().update(String(value || '')).digest().toHex()
}

/**
 * Bind password material to email (legacy + new KDF input).
 * Client may send SHA512(password); otherwise we hash plaintext first.
 */
function passwordMaterial (email, password, isAlreadyHashed = false) {
  const inner = isAlreadyHashed ? password : sha512Hex(password)
  // Match legacy node-forge: SHA512(email || SHA512(password)) without lowercasing email
  return sha512Hex(String(email || '') + inner)
}

function scryptHash (material) {
  const salt = crypto.randomBytes(SCRYPT_SALT_BYTES)
  const derived = crypto.scryptSync(material, salt, SCRYPT_KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P
  })
  return [
    SCRYPT_PREFIX + SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString('hex'),
    derived.toString('hex')
  ].join('$')
}

function scryptVerify (material, stored) {
  const parts = String(stored || '').split('$')
  // scrypt$N$r$p$salt$hash  → ['scrypt', 'N', 'r', 'p', 'salt', 'hash'] when split on $
  // Actually SCRYPT_PREFIX is 'scrypt$' so split yields: ['scrypt', N, r, p, salt, hash]
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false
  const N = Number(parts[1])
  const r = Number(parts[2])
  const p = Number(parts[3])
  const salt = Buffer.from(parts[4], 'hex')
  const expected = Buffer.from(parts[5], 'hex')
  if (!salt.length || !expected.length || !N || !r || !p) return false
  const derived = crypto.scryptSync(material, salt, expected.length, { N, r, p })
  return crypto.timingSafeEqual(derived, expected)
}

function legacyHash (email, password, isAlreadyHashed = false) {
  return passwordMaterial(email, password, isAlreadyHashed)
}

/**
 * Hash password for storage (scrypt over email-bound material).
 * Keeps client pre-hash compatibility via isAlreadyHashed / auto-detect.
 */
export const hashPassword = (email, password, isAlreadyHashed = false) => {
  const already = isAlreadyHashed || isClientPasswordHash(password)
  return scryptHash(passwordMaterial(email, password, already))
}

/**
 * Verify password against stored hash (scrypt or legacy double-SHA512).
 */
export const verifyPassword = (email, password, storedHash, isAlreadyHashed = false) => {
  if (!storedHash || !password) return false
  const already = isAlreadyHashed || isClientPasswordHash(password)
  const material = passwordMaterial(email, password, already)
  if (String(storedHash).startsWith(SCRYPT_PREFIX)) {
    return scryptVerify(material, storedHash)
  }
  // Legacy: SHA512(email || SHA512(password)) hex
  const legacy = legacyHash(email, password, already)
  try {
    const a = Buffer.from(legacy, 'utf8')
    const b = Buffer.from(String(storedHash), 'utf8')
    if (a.length !== b.length) return false
    return crypto.timingSafeEqual(a, b)
  } catch {
    return false
  }
}

export const needsPasswordRehash = (storedHash) => {
  return !String(storedHash || '').startsWith(SCRYPT_PREFIX)
}

/** Minimum plaintext password length for console accounts. */
export const MIN_PASSWORD_LENGTH = 12

/**
 * Validate console password policy.
 * Client-prehashed SHA-512 hex cannot be checked for complexity — callers must
 * enforce length in the UI before hashing. Plaintext passwords are checked here.
 * @returns {{ ok: true } | { ok: false, message: string }}
 */
export function assertPasswordPolicy (password) {
  if (!password || typeof password !== 'string') {
    return { ok: false, message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` }
  }
  if (isClientPasswordHash(password)) {
    return { ok: true }
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` }
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return { ok: false, message: 'Password must include letters and numbers' }
  }
  return { ok: true }
}

export default hashPassword
