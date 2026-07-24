'use strict'

import { sha256Hex, randomInt } from '../../../lib/forge.js'
import { escapeHtml } from '../../../lib/template.js'
import { APP_DOWNLOAD_URL_ANDROID, APP_DOWNLOAD_URL_IOS } from './constants.js'
import { formatAuthText, getAuthText } from './i18n.js'

export const hashCode = (input) => sha256Hex(String(input))

export function normalizeIdentifier(type, value) {
  if (!value || typeof value !== 'string') return ''
  const v = value.trim()
  if (type === 'email') return v.toLowerCase()
  if (type === 'phone') return v.replace(/\D/g, '')
  return v
}

export const isValidEmailForSending = (s) =>
  typeof s === 'string' && s.length >= 6 && /@/.test(s) && !/^[0-9a-f]{64,}$/i.test(s.trim())

export const generateVerificationCode = () => String(randomInt(100000, 1000000))

function trimTrailingSlash(value) {
  return String(value || '').trim().replace(/\/+$/, '')
}

function normalizeHttpOrigin(value) {
  const raw = trimTrailingSlash(value)
  if (!raw) return ''
  try {
    const url = new URL(raw)
    return ['http:', 'https:'].includes(url.protocol) ? trimTrailingSlash(url.origin) : ''
  } catch {
    return ''
  }
}

function normalizeDomainOrigin(value) {
  const raw = trimTrailingSlash(value)
  if (!raw) return ''
  if (/^https?:\/\//i.test(raw)) return normalizeHttpOrigin(raw)
  return normalizeHttpOrigin(`https://${raw}`)
}

function resolveLocalhostBaseUrl() {
  const port = String(process.env.PORT || '3030').trim()
  return port && port !== '80' ? `http://localhost:${port}` : 'http://localhost'
}

export function resolvePublicBaseUrl(_ctx) {
  const publicBaseUrl = normalizeHttpOrigin(process.env.PUBLIC_BASE_URL || '')
    || normalizeDomainOrigin(process.env.PUBLIC_BASE_URL || '')
  if (publicBaseUrl) return publicBaseUrl

  return resolveLocalhostBaseUrl()
}

// 이메일 링크가 아닌 브라우저 리다이렉트용: 요청이 들어온 origin을 우선 사용
export function resolveRequestBaseUrl(ctx) {
  if (ctx?.request) {
    const origin = normalizeHttpOrigin(ctx.request.origin || '')
    if (origin) return origin
  }
  return resolveLocalhostBaseUrl()
}

export function buildVerifyEmailUrl(baseUrl, {
  requestId = '',
  email = '',
  redirectUri = '',
  state = '',
  appName = '',
  locale = 'ko'
} = {}) {
  const origin = trimTrailingSlash(baseUrl)
  if (!origin) return ''

  const params = new URLSearchParams()
  params.set('request_id', String(requestId || ''))
  params.set('email', String(email || ''))
  params.set('redirect_uri', String(redirectUri || ''))
  params.set('state', String(state || ''))
  params.set('app_name', String(appName || ''))
  params.set('lang', String(locale || 'ko'))
  return `${origin}/api/web/verify-email?${params.toString()}`
}

export function getDeviceTypeFromUserAgent(ua) {
  if (!ua || typeof ua !== 'string') return 'PC'
  const s = ua.toLowerCase()
  if (/\bokhttp\b/.test(s) || /\bwv\b/.test(s)) return 'App'
  if (/\b(android|iphone|ipod|ipad|mobile|webos|blackberry|iemobile|opera mini)\b/.test(s)) return 'Mobile'
  return 'PC'
}

export function getGuideImageUrl(baseUrl, step) {
  const envUrl = process.env[`GUIDE_STEP${step}_IMAGE`]
  if (envUrl) return envUrl
  if (baseUrl) return `${baseUrl}/api/web/guide/images/step${step}.svg`
  return `https://placehold.co/320x240/e8eef5/262626?text=Step+${step}`
}

function normalizeDownloadUrl(value) {
  if (!value || typeof value !== 'string') return ''
  try {
    const url = new URL(value.trim())
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : ''
  } catch {
    return ''
  }
}

function storeIconSvg(platform) {
  if (platform === 'ios') {
    return '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>'
  }
  return '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M3.609 1.814L13.792 12 3.61 22.186a1.003 1.003 0 0 1-.61-.92V2.734a1 1 0 0 1 .609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.198l2.807 1.626a1 1 0 0 1 0 1.73l-2.808 1.626L15.206 12l2.492-2.491zM5.864 2.658L16.802 8.99l-2.302 2.302-8.636-8.634z"/></svg>'
}

export function renderAppDownloadButton(platform, locale = 'ko') {
  const isIos = platform === 'ios'
  const url = normalizeDownloadUrl(isIos ? APP_DOWNLOAD_URL_IOS : APP_DOWNLOAD_URL_ANDROID)
  const label = isIos ? 'App Store' : 'Google Play'
  const className = isIos ? 'btn-ios' : 'btn-android'
  const icon = `<span class="store-icon" aria-hidden="true">${storeIconSvg(platform)}</span>`
  const text = getAuthText(locale)
  if (!url) {
    return `<span class="btn btn-store btn-store-pending" aria-disabled="true">${icon}<span>${escapeHtml(formatAuthText(text.storePending, { store: label }))}</span></span>`
  }
  return `<a href="${escapeHtml(url)}" class="btn btn-store ${className}" target="_blank" rel="noopener">${icon}<span>${escapeHtml(formatAuthText(text.storeDownload, { store: label }))}</span></a>`
}

export function getServerInfo(application, redirectUri, locale = 'ko') {
  if (!application || !redirectUri || typeof redirectUri !== 'string') return null
  try {
    const text = getAuthText(locale)
    const url = new URL(redirectUri)
    const isHttps = url.protocol === 'https:'
    const hostname = url.hostname || ''
    const faviconUrl = hostname
      ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=32`
      : ''
    return {
      appName: application.name || text.unknownApp,
      siteOrigin: url.origin,
      hostname,
      faviconUrl,
      isHttps,
      certificateLabel: isHttps ? text.certificateSecure : text.certificateInsecure,
      certificateStatus: isHttps ? 'secure' : 'insecure',
      phishingStatus: 'safe',
      phishingLabel: text.phishingSafe
    }
  } catch {
    return null
  }
}

export { APP_DOWNLOAD_URL_ANDROID, APP_DOWNLOAD_URL_IOS }
