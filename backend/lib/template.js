'use strict'

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const TEMPLATES_DIR = path.resolve(__dirname, '../templates')

/**
 * 템플릿 파일을 읽어 {{key}} 플레이스홀더를 치환합니다.
 * @param {string} name - 템플릿 파일명 (예: 'auth-error.html')
 * @param {Record<string, string>} data - 치환할 키-값 (값은 이미 이스케이프된 문자열 권장)
 * @returns {string} 렌더된 HTML
 */
export function renderTemplate(name, data = {}) {
  const filePath = path.join(TEMPLATES_DIR, name)
  let html = fs.readFileSync(filePath, 'utf8')
  for (const [key, value] of Object.entries(data)) {
    html = html.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value)
  }
  return html
}

/**
 * HTML 이스케이프
 */
export function escapeHtml(str) {
  if (str == null) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
