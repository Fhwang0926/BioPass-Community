'use strict'

import nodemailer from 'nodemailer'
import config from '../config.js'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Decide whether an SMTP error is permanent (no point retrying).
 * Permanent: auth failure, invalid envelope/recipient, or a 5xx response code.
 * Everything else (connection reset, timeout, DNS, 4xx greylisting) is treated as transient.
 */
function isPermanentMailError(error) {
  if (!error) return false
  const code = error.code
  if (code === 'EAUTH' || code === 'EENVELOPE') return true
  const responseCode = Number(error.responseCode)
  if (responseCode >= 500 && responseCode < 600) return true
  return false
}

class SMTP {
  constructor() {
    this.server = null
  }

  /**
   * Initialize the SMTP transport.
   * If SMTP_USER/SMTP_PASS are not set, server stays null and no error is thrown (app can run without mail).
   */
  async init() {
    const user = config.mail?.user || ''
    const pass = config.mail?.pass || ''
    if (!user || !pass) {
      this.server = null
      console.log('SMTP: skipped (SMTP_USER/SMTP_PASS not set). Email sending disabled.')
      return
    }

    const host = config.mail?.host || ''
    if (!host) {
      this.server = null
      console.log('SMTP: skipped (SMTP_HOST not set). Email sending disabled.')
      return
    }
    const port = Number(config.mail?.port) || 587
    const secure = port === 465

    try {
      this.server = nodemailer.createTransport({
        host,
        port,
        secure,
        tls: { rejectUnauthorized: true },
        auth: { user, pass }
      })
      console.log('SMTP: initialized.', host + ':' + port)
    } catch (error) {
      console.error('SMTP: init failed.', error.message)
      this.server = null
    }
  }

  /**
   * Send an email, retrying transient SMTP failures with exponential backoff.
   *
   * Retries happen in-line (within seconds) so time-sensitive payloads such as
   * verification codes are re-sent while still valid. Permanent failures
   * (bad credentials, invalid recipient, 5xx) are not retried.
   *
   * @param {Object} data - { to, subject, html?, text?, cc?, bcc? }
   * @returns {Promise<Object>} nodemailer sendMail result
   */
  async send(data) {
    if (!this.server) {
      throw new Error('SMTP not configured or init failed. Set SMTP_USER and SMTP_PASS in .env and restart.')
    }

    const maxRetries = Math.max(0, Number(config.mail?.maxRetries ?? 2))
    const baseDelay = Math.max(0, Number(config.mail?.retryDelayMs ?? 500))
    const payload = { ...data, from: data.from || config.mail?.user }

    let lastError = null
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.server.sendMail(payload)
      } catch (error) {
        lastError = error
        const permanent = isPermanentMailError(error)
        const hasRetryLeft = attempt < maxRetries
        if (permanent || !hasRetryLeft) {
          console.error(
            `SMTP send failed (attempt ${attempt + 1}/${maxRetries + 1}${permanent ? ', permanent' : ''}):`,
            data.to,
            error.message
          )
          throw error
        }
        const delay = baseDelay * Math.pow(2, attempt)
        console.warn(
          `SMTP send failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms:`,
          data.to,
          error.message
        )
        await sleep(delay)
      }
    }
    throw lastError
  }
}

const smtp = new SMTP()
export default smtp
