'use strict'

const SUPPORTED_LOCALES = new Set(['ko', 'en'])

const AUTH_TEXT = {
  ko: {
    locale: 'ko',
    htmlLang: 'ko',
    numberLocale: 'ko-KR',
    pageTitle: '로그인 확인',
    loadingEmail: '이메일로 보안 코드를 전송 중입니다...',
    loadingSubtext: '잠시만 기다려 주세요',
    stepVerify: '보안 코드 확인 중',
    stepAuth: '로그인 인증 처리 중',
    stepRedirect: '서비스로 이동 중',
    backAria: '이전 페이지로 이동',
    backLabel: '이전',
    headerTitle: '보안을 위해 로그인 확인이 필요합니다',
    heroSub: '아래 단계를 진행하면 요청하신 서비스로 안전하게 로그인됩니다.',
    errorTitle: '이 인증 방식으로 로그인할 수 없습니다',
    errorDescription: '보안 정책 또는 인증 상태로 인해 다른 인증 방법을 사용해 주세요.',
    emailLoginButton: '이메일 인증으로 로그인',
    backButton: '이전 페이지로 돌아가기',
    serverInfoTitle: '로그인 요청 서비스',
    metaServiceName: '서비스명',
    metaSite: '사이트',
    metaConnectionSecurity: '연결 보안',
    metaPhishingCheck: '피싱 검사',
    dividerOr: '또는',
    verifyEmailTitle: '보안 코드 입력',
    verifyEmailDescriptionPrefix: '',
    verifyEmailDescriptionSuffix: '으로 1회성 보안 코드를 전송했습니다. 아래에 6자리 코드를 입력하세요.',
    verifyEmailSubmitHint: '요청 중에는 다시 보내지 마세요.',
    verifyEmailSubmitButton: '로그인 완료',
    resendHint: '코드를 받지 못하셨나요?',
    resendButtonText: '보안 코드 다시 받기',
    resendButtonLoading: '발송 중...',
    resendSuccess: '새 보안 코드를 발송했습니다. 이메일을 확인해 주세요.',
    resendCooldownSuffix: '초 후에 다시 요청할 수 있습니다.',
    appNoticeTitle: '다음부터는 더 빠르게 로그인하세요',
    verifyAppNoticeDesc: 'Bio-Pass 앱을 설치하면 이메일 코드 없이 바이오 인증만으로 로그인할 수 있습니다. 한 번 연결하면 이후에는 추가 입력 없이 승인할 수 있어요.',
    emailLabel: '이메일 주소',
    emailCodeButton: '보안 코드 받기',
    emailFormHint: '입력한 이메일로 6자리 보안 코드가 전송됩니다. 이 코드는 1회만 사용 가능하며 잠시 후 만료됩니다.',
    emailAppInstallTitle: '다음부터는 더 빠르게 로그인하세요',
    emailAppInstallDesc: 'Bio-Pass 앱을 설치하면 이메일 입력 없이 바이오 인증으로 바로 로그인할 수 있습니다.',
    emailAppInstallSub: '한 번 연결하면 이후부터는 추가 입력 없이 승인할 수 있습니다.',
    guideTitle: '로그인 방법',
    bioTitle: '바이오 인증으로 로그인 승인 (권장)',
    bioDesc: '가장 빠르고 안전한 로그인 방식입니다. 앱에서 얼굴 또는 지문으로 로그인 요청을 승인해 주세요.',
    bioFallbackHint: '등록된 앱이 없습니다. 이메일 인증으로 로그인해 주세요.',
    bioCta: '앱에서 승인하기',
    emailAuthFallbackTitle: '이메일로 보안 코드 받기',
    emailAuthPrimaryTitle: '이메일로 로그인하기',
    emailAuthFallbackDescription: '앱을 사용할 수 없는 경우, 이메일로 1회성 보안 코드를 받아 로그인할 수 있습니다.',
    emailAuthPrimaryDescription: '연결된 앱이 없어 이메일로 1회성 보안 코드를 받아 로그인합니다.',
    guideConnected1: '(권장) 앱에서 바이오 인증으로 로그인 승인',
    guideConnected2: '앱을 사용할 수 없는 경우 이메일 인증으로 로그인',
    guideConnected3: '로그인 완료',
    guideNoApp1: '이메일 주소로 보안 코드 받기',
    guideNoApp2: '메일로 받은 6자리 보안 코드 입력',
    guideNoApp3: '앱을 설치하면 다음부터 바이오 인증으로 빠르게 로그인',
    authChoiceTitle: '모바일 앱 알림을 확인해 주세요',
    authChoiceNoPushTitle: '이메일 보안 코드로 인증해 주세요',
    authChoiceDescription: '{email} 계정으로 모바일 앱 인증 요청을 보냈습니다. 앱에서 알림을 열어 승인해 주세요.',
    authChoiceNoPushDescription: '{email} 계정에 등록된 모바일 알림 기기가 없습니다. 이메일 보안 코드로 인증해 주세요.',
    authChoicePushButton: '알림 다시 보내기',
    authChoiceEmailButton: '이메일 보안 코드로 인증',
    authChoicePushWaiting: '모바일 앱에서 인증 알림을 확인해 주세요.',
    authChoicePushSent: '모바일 앱으로 인증 요청을 보냈습니다. 앱에서 승인해 주세요.',
    authChoicePushFailed: '자동 알림 전송에 실패했습니다. 다시 알림 보내기를 눌러 주세요.',
    storePending: '{store} 준비중 입니다',
    storeDownload: '{store}에서 다운로드',
    certificateSecure: '정상 (HTTPS)',
    certificateInsecure: '비보안 (HTTP)',
    phishingSafe: '피싱 사이트 아님',
    unknownApp: '알 수 없음',
    mailSubject: 'BioPass 로그인 인증 코드',
    mailIntro: 'BioPass 로그인 인증 코드입니다.',
    mailLinkIntro: '아래 링크를 열어 인증 페이지에서 코드를 입력할 수 있습니다.',
    mailLinkButton: '인증 코드 입력하기',
    mailExpiry: '3분 이내에 입력해 주세요.',
    missingRequestEmail: 'request_id와 email이 필요합니다.',
    clientIdRequired: 'client_id가 필요합니다.',
    redirectUriRequired: 'redirect_uri가 필요합니다.',
    invalidClient: '유효하지 않은 client_id입니다.',
    inactiveClient: '비활성화된 애플리케이션입니다.',
    redirectUriMismatch: 'redirect_uri가 애플리케이션에 등록된 URL과 일치하지 않습니다.',
    emailUnsupported: 'email 인증을 지원하지 않는 애플리케이션입니다.',
    emailRequired: '이메일 주소를 입력해 주세요.',
    invalidEmailForAuth: '이메일 인증을 위해 올바른 이메일 주소를 입력해 주세요. (해시가 아닌 실제 주소)',
    securityPolicyBlocked: '보안 정책에 의해 인증 요청이 차단되었습니다.',
    requestEmailServerError: '이메일 인증 코드 요청 중 오류가 발생했습니다.',
    resendMissingAuth: '인증 정보가 부족합니다. 페이지를 새로고침 후 다시 시도해 주세요.',
    resendSuccessMessage: '새 보안 코드를 발송했습니다.',
    resendServerError: '보안 코드 재발송 중 오류가 발생했습니다.',
    invalidCode: '보안 코드가 올바르지 않습니다. 다시 확인해 주세요.',
    authAlreadyProcessed: '인증 요청이 없거나 이미 처리되었습니다. 처음부터 다시 시도해 주세요.',
    codeExpired: '보안 코드가 만료되었습니다. 새 보안 코드를 받아 다시 시도해 주세요.',
    transitionFailed: '인증 처리에 실패했습니다. 다시 시도해 주세요.',
    authCodeIssue: '인증 코드 발급에 실패했습니다. 다시 시도해 주세요.',
    redirectUriMissing: 'redirect_uri가 없어 콜백할 수 없습니다.',
    js: {
      bioNoDevices: '등록된 앱이 없습니다. 이메일 인증을 이용해 주세요.',
      bioSent: '앱으로 로그인 요청을 보냈습니다. 앱에서 승인해 주세요.',
      bioProcessed: '요청을 처리했습니다. 앱을 확인해 주세요.',
      bioFailed: '알림 전송에 실패했습니다. 이메일 인증을 이용해 주세요.',
      appApproved: '앱 승인이 완료되었습니다. 로그인 처리 중입니다.',
      appDenied: '앱에서 로그인을 거절했습니다. 처음부터 다시 시도해 주세요.',
      appExpired: '인증 요청이 만료되었습니다. 처음부터 다시 시도해 주세요.',
      appCompleted: '이미 처리된 인증 요청입니다. 처음부터 다시 시도해 주세요.',
      loadingVerify: '보안 코드를 확인하고 있습니다',
      loadingSuccess: '로그인이 완료되었습니다!',
      codeRequired: '6자리 보안 코드를 입력해 주세요.',
      verifyFailed: '보안 코드 확인에 실패했습니다.',
      codeAlreadyUsed: '이미 사용된 보안 코드입니다. 새 보안 코드를 받아 시도해 주세요.',
      redirectMissing: '처리에 성공했으나 리다이렉트할 수 없습니다. 새로고침하거나 처음부터 다시 시도해 주세요.',
      networkError: '네트워크 오류가 발생했습니다. 다시 시도해 주세요.',
      emailMissing: '이메일 정보가 없습니다. 페이지를 새로고침해 주세요.',
      resendFailed: '재발송에 실패했습니다.'
    }
  },
  en: {
    locale: 'en',
    htmlLang: 'en',
    numberLocale: 'en-US',
    pageTitle: 'Login Verification',
    loadingEmail: 'Sending a security code by email...',
    loadingSubtext: 'Please wait a moment',
    stepVerify: 'Checking security code',
    stepAuth: 'Processing login verification',
    stepRedirect: 'Redirecting to the service',
    backAria: 'Go back',
    backLabel: 'Back',
    headerTitle: 'Confirm your login to continue securely',
    heroSub: 'Complete the steps below to sign in safely to the requested service.',
    errorTitle: 'This sign-in method is not available',
    errorDescription: 'Use another verification method because of the current security policy or authentication state.',
    emailLoginButton: 'Sign in with email',
    backButton: 'Go back',
    serverInfoTitle: 'Service requesting login',
    metaServiceName: 'Service',
    metaSite: 'Site',
    metaConnectionSecurity: 'Connection security',
    metaPhishingCheck: 'Phishing check',
    dividerOr: 'or',
    verifyEmailTitle: 'Enter security code',
    verifyEmailDescriptionPrefix: 'We sent a one-time security code to ',
    verifyEmailDescriptionSuffix: '. Enter the 6-digit code below.',
    verifyEmailSubmitHint: 'Please do not submit again while the request is processing.',
    verifyEmailSubmitButton: 'Complete login',
    resendHint: 'Did not receive the code?',
    resendButtonText: 'Resend security code',
    resendButtonLoading: 'Sending...',
    resendSuccess: 'A new security code has been sent. Please check your email.',
    resendCooldownSuffix: 'seconds until you can request another code.',
    appNoticeTitle: 'Sign in faster next time',
    verifyAppNoticeDesc: 'Install the Bio-Pass app to sign in with biometric approval instead of email codes. Once connected, you can approve future logins without extra input.',
    emailLabel: 'Email address',
    emailCodeButton: 'Get security code',
    emailFormHint: 'A 6-digit security code will be sent to the email address you enter. The code can be used once and expires shortly.',
    emailAppInstallTitle: 'Sign in faster next time',
    emailAppInstallDesc: 'Install the Bio-Pass app to sign in with biometric approval without entering your email.',
    emailAppInstallSub: 'After one connection, you can approve future logins without additional input.',
    guideTitle: 'Login steps',
    bioTitle: 'Approve login with biometric verification (recommended)',
    bioDesc: 'This is the fastest and safest sign-in method. Approve the login request in the app using face or fingerprint verification.',
    bioFallbackHint: 'No registered app was found. Please sign in with email verification.',
    bioCta: 'Approve in app',
    emailAuthFallbackTitle: 'Get a security code by email',
    emailAuthPrimaryTitle: 'Sign in with email',
    emailAuthFallbackDescription: 'If you cannot use the app, receive a one-time security code by email to sign in.',
    emailAuthPrimaryDescription: 'No connected app was found, so sign in with a one-time security code by email.',
    guideConnected1: '(Recommended) Approve the login in the app with biometric verification',
    guideConnected2: 'Use email verification if the app is unavailable',
    guideConnected3: 'Login complete',
    guideNoApp1: 'Get a security code by email',
    guideNoApp2: 'Enter the 6-digit code from your email',
    guideNoApp3: 'Install the app to sign in faster with biometric verification next time',
    authChoiceTitle: 'Check your mobile app notification',
    authChoiceNoPushTitle: 'Use an email security code',
    authChoiceDescription: 'We sent a verification request for {email}. Open the notification in the mobile app to approve it.',
    authChoiceNoPushDescription: 'No mobile notification device is registered for {email}. Use an email security code instead.',
    authChoicePushButton: 'Send notification again',
    authChoiceEmailButton: 'Use email security code',
    authChoicePushWaiting: 'Check the verification notification in the mobile app.',
    authChoicePushSent: 'We sent the verification request to your mobile app. Approve it there.',
    authChoicePushFailed: 'Automatic notification delivery failed. Use Send notification again.',
    storePending: '{store} coming soon',
    storeDownload: 'Download on {store}',
    certificateSecure: 'Secure (HTTPS)',
    certificateInsecure: 'Not secure (HTTP)',
    phishingSafe: 'Not a phishing site',
    unknownApp: 'Unknown',
    mailSubject: 'Your BioPass login verification code',
    mailIntro: 'Your BioPass login verification code is below.',
    mailLinkIntro: 'Open the link below to enter this code on the verification page.',
    mailLinkButton: 'Enter security code',
    mailExpiry: 'Enter it within 3 minutes.',
    missingRequestEmail: 'request_id and email are required.',
    clientIdRequired: 'client_id is required.',
    redirectUriRequired: 'redirect_uri is required.',
    invalidClient: 'The client_id is not valid.',
    inactiveClient: 'This application is inactive.',
    redirectUriMismatch: 'redirect_uri does not match the URL registered for this application.',
    emailUnsupported: 'This application does not support email verification.',
    emailRequired: 'Please enter your email address.',
    invalidEmailForAuth: 'Please enter a valid email address for email verification. (Use the actual address, not a hash.)',
    securityPolicyBlocked: 'This authentication request was blocked by a security policy.',
    requestEmailServerError: 'An error occurred while requesting the email verification code.',
    resendMissingAuth: 'Authentication information is missing. Refresh the page and try again.',
    resendSuccessMessage: 'A new security code has been sent.',
    resendServerError: 'An error occurred while resending the security code.',
    invalidCode: 'The security code is not correct. Please check it and try again.',
    authAlreadyProcessed: 'The authentication request does not exist or has already been processed. Please start again.',
    codeExpired: 'The security code has expired. Request a new code and try again.',
    transitionFailed: 'Failed to process authentication. Please try again.',
    authCodeIssue: 'Failed to issue an authorization code. Please try again.',
    redirectUriMissing: 'redirect_uri is missing, so we cannot return you to the service.',
    js: {
      bioNoDevices: 'No registered app was found. Please use email verification.',
      bioSent: 'We sent the login request to the app. Please approve it there.',
      bioProcessed: 'The request was processed. Please check the app.',
      bioFailed: 'Failed to send the app notification. Please use email verification.',
      appApproved: 'App approval is complete. Processing your login.',
      appDenied: 'The login was denied in the app. Please start again.',
      appExpired: 'This authentication request has expired. Please start again.',
      appCompleted: 'This authentication request was already processed. Please start again.',
      loadingVerify: 'Checking the security code',
      loadingSuccess: 'Login complete!',
      codeRequired: 'Please enter the 6-digit security code.',
      verifyFailed: 'Failed to verify the security code.',
      codeAlreadyUsed: 'This security code has already been used. Request a new code and try again.',
      redirectMissing: 'The request succeeded, but we could not redirect you. Refresh the page or start again.',
      networkError: 'A network error occurred. Please try again.',
      emailMissing: 'Email information is missing. Please refresh the page.',
      resendFailed: 'Failed to resend the code.'
    }
  }
}

function normalizeLocale(value) {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (!raw) return ''
  const code = raw.split(',')[0].split(';')[0].split('-')[0].split('_')[0]
  return SUPPORTED_LOCALES.has(code) ? code : ''
}

export function resolveAuthLocale(ctx = null, preferred = '') {
  const explicit = normalizeLocale(preferred)
  if (explicit) return explicit

  const query = ctx?.request?.query || {}
  const body = ctx?.request?.body || {}
  const fromQuery = normalizeLocale(query.lang || query.locale)
  if (fromQuery) return fromQuery
  const fromBody = normalizeLocale(body.lang || body.locale)
  if (fromBody) return fromBody

  const acceptLanguage = ctx?.request?.headers?.['accept-language'] || ''
  const candidates = String(acceptLanguage).split(',')
  for (const candidate of candidates) {
    const locale = normalizeLocale(candidate)
    if (locale) return locale
  }
  return 'ko'
}

export function getAuthText(locale = 'ko') {
  return AUTH_TEXT[normalizeLocale(locale) || 'ko']
}

function safeJson(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
}

export function authTemplateVars(locale, escapeHtml) {
  const t = getAuthText(locale)
  const vars = {}
  for (const [key, value] of Object.entries(t)) {
    if (key === 'js') continue
    vars[key] = escapeHtml(value)
  }
  vars.authI18nJson = safeJson(t.js)
  vars.authLocale = escapeHtml(t.locale)
  vars.authJsNumberLocale = escapeHtml(t.numberLocale)
  return vars
}

export function formatAuthText(template, values = {}) {
  return String(template).replace(/\{(\w+)\}/g, (_, key) => values[key] ?? '')
}

export function authMailSubject(locale) {
  return getAuthText(locale).mailSubject
}

function escapeMailHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function normalizeMailLink(value) {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) return ''
  try {
    const url = new URL(raw)
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : ''
  } catch {
    return ''
  }
}

export function authMailHtml(locale, code, verifyUrl = '') {
  const t = getAuthText(locale)
  const safeVerifyUrl = escapeMailHtml(normalizeMailLink(verifyUrl))
  const linkHtml = safeVerifyUrl
    ? `<p>${escapeMailHtml(t.mailLinkIntro)}</p><p><a href="${safeVerifyUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:10px 16px;background:#00a870;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">${escapeMailHtml(t.mailLinkButton)}</a></p>`
    : ''
  return `<p>${escapeMailHtml(t.mailIntro)}</p><p><strong>${escapeMailHtml(code)}</strong></p>${linkHtml}<p>${escapeMailHtml(t.mailExpiry)}</p>`
}
