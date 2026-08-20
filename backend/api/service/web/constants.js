'use strict'

import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const GUIDE_IMAGES_DIR = path.resolve(__dirname, '../../../templates/guide-images')
const ALLOWED_GUIDE_IMAGES = ['step1.svg', 'step2.svg', 'step3.svg']

const APP_DOWNLOAD_URL_ANDROID = (process.env.APP_DOWNLOAD_URL_ANDROID || process.env.APP_DOWNLOAD_URL || '').trim()
/** Companion iOS app: Bio Pass (App Store id 6760216314). Override via env if needed. */
const APP_DOWNLOAD_URL_IOS = (
  process.env.APP_DOWNLOAD_URL_IOS ||
  process.env.APP_DOWNLOAD_URL ||
  'https://apps.apple.com/br/app/bio-pass/id6760216314'
).trim()

/** 앱 딥링크: 로그인 승인 화면으로 이동 (scheme + path, 예: biopass://auth) */
const APP_DEEP_LINK_SCHEME = process.env.APP_DEEP_LINK_SCHEME || 'biopass'
const APP_DEEP_LINK_PATH = process.env.APP_DEEP_LINK_PATH || 'auth'
const APP_PACKAGE_ANDROID = process.env.APP_PACKAGE_ANDROID || 'com.mfa.biopass'

const WEB_AUTH_FROM = 'web_auth'

export {
  __dirname,
  GUIDE_IMAGES_DIR,
  ALLOWED_GUIDE_IMAGES,
  APP_DOWNLOAD_URL_ANDROID,
  APP_DOWNLOAD_URL_IOS,
  APP_DEEP_LINK_SCHEME,
  APP_DEEP_LINK_PATH,
  APP_PACKAGE_ANDROID,
  WEB_AUTH_FROM
}
