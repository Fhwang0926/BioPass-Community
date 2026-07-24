'use strict'

/** 민감정보 노출 줄이기: 로컬 검색용 형태만 */
export function maskEmailForAuthorizeLog(email) {
  if (!email || typeof email !== 'string') return ''
  const at = email.indexOf('@')
  if (at < 1) return '***'
  const head = email.slice(0, Math.min(2, at))
  return `${head}***${email.slice(at)}`
}

export function maskClientIdHint(clientId) {
  if (!clientId || typeof clientId !== 'string') return ''
  if (clientId.length <= 10) return clientId.slice(0, 3) + '…'
  return `${clientId.slice(0, 6)}…${clientId.slice(-4)}`
}

/**
 * 표준 라우팅 구분값 (헤더/JSON 라우팅용)
 */
export const AuthorizeRouting = {
  PHONE_DEVICE_PUSH_AND_CALLBACK_REDIRECT: 'phone_device_push_and_callback_redirect',
  EMAIL_DEVICE_GUIDE_HTML_APP_PRIMARY: 'email_device_guide_html_app_primary',
  EMAIL_NEW_OR_NO_DEVICE_SEND_CODE: 'email_new_or_no_device_smtp_then_verify_redirect',
  GUIDE_NEED_IDENTIFIER_HTML: 'guide_need_identifier_html',
  GUIDE_PHONE_NO_REGISTERED_DEVICE_HTML: 'guide_phone_no_registered_device_hint_html'
}

const UX_HINT = {
  [AuthorizeRouting.PHONE_DEVICE_PUSH_AND_CALLBACK_REDIRECT]:
    '클라이언트 등록 리다이렉트(URL) 후 Bio-Pass 앱 푸시를 받습니다. 앱에서 로그인 승인 버튼·바이오 인증으로 진행하면 됩니다.',
  [AuthorizeRouting.EMAIL_DEVICE_GUIDE_HTML_APP_PRIMARY]:
    'HTML 가이드에서 「앱에서 승인하기」가 주 경로입니다(푸시 대기). 앱이 불가하면 같은 화면의 「이메일로 보안 코드 받기」로 보조 진행하면 됩니다.',
  [AuthorizeRouting.EMAIL_NEW_OR_NO_DEVICE_SEND_CODE]:
    '/api/web/verify-email 로 이동해 이메일로 받은 6자리 코드를 입력하는 화면이 주 경로입니다. SMTP 실패 시 email_sent=0 안내 후 「다시 받기」입니다.',
  [AuthorizeRouting.GUIDE_NEED_IDENTIFIER_HTML]:
    '브라우저 가이드에서 이메일을 입력 후 보안 코드를 받거나 앱 안내를 따르면 됩니다.',
  [AuthorizeRouting.GUIDE_PHONE_NO_REGISTERED_DEVICE_HTML]:
    '전화번호는 조회되었으나 등록된 앱이 없습니다. 같은 가이드에서 이메일 인증 또는 앱 설치 안내를 따르면 됩니다.'
}

export function getAuthorizeUxHint(routing) {
  return UX_HINT[routing] || 'HTML 가이드 또는 리다이렉트된 화면의 안내를 따르면 됩니다.'
}

/**
 * @param {Record<string, unknown>} payload
 */
export function logAuthorizeDecision(payload) {
  const line = {
    tag: '[web][authorize]',
    ts: new Date().toISOString(),
    ...payload
  }
  console.info(JSON.stringify(line))
}
