'use strict'

/**
 * Simple in-memory sliding-window rate limiter for self-hosted deployments.
 * Prefer reverse-proxy limits in production; this is a baseline.
 */

const buckets = new Map()

function prune (now) {
  if (buckets.size < 5000) return
  for (const [key, entry] of buckets) {
    if (entry.resetAt <= now) buckets.delete(key)
  }
}

/**
 * @param {object} opts
 * @param {string} opts.key
 * @param {number} opts.limit
 * @param {number} opts.windowMs
 * @returns {{ allowed: boolean, retryAfterSec: number }}
 */
export function consumeRateLimit ({ key, limit, windowMs }) {
  const now = Date.now()
  prune(now)
  const entry = buckets.get(key)
  if (!entry || entry.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, retryAfterSec: Math.ceil(windowMs / 1000) }
  }
  entry.count += 1
  const retryAfterSec = Math.max(1, Math.ceil((entry.resetAt - now) / 1000))
  if (entry.count > limit) {
    return { allowed: false, retryAfterSec }
  }
  return { allowed: true, retryAfterSec }
}

/**
 * Koa middleware factory.
 * @param {(ctx) => string} keyFn
 * @param {{ limit: number, windowMs: number, message?: string }} options
 */
export function rateLimitMiddleware (keyFn, options) {
  const limit = options.limit
  const windowMs = options.windowMs
  const message = options.message || 'Too many requests. Please try again later.'
  const code = options.code || 'RATE_LIMITED'

  return async (ctx, next) => {
    const key = keyFn(ctx)
    if (!key) return next()
    const result = consumeRateLimit({ key, limit, windowMs })
    ctx.set('X-RateLimit-Limit', String(limit))
    if (!result.allowed) {
      ctx.set('Retry-After', String(result.retryAfterSec))
      ctx.status = 429
      ctx.body = { result: false, message, code }
      return
    }
    return next()
  }
}

export default { consumeRateLimit, rateLimitMiddleware }
