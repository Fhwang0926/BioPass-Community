'use strict'

import { renderTemplate, escapeHtml } from '../../../lib/template.js'
import { APP_DEEP_LINK_SCHEME, APP_DEEP_LINK_PATH, APP_PACKAGE_ANDROID } from './constants.js'
import { authTemplateVars, formatAuthText, getAuthText, resolveAuthLocale } from './i18n.js'
import {
  getGuideImageUrl,
  getServerInfo,
  resolvePublicBaseUrl,
  renderAppDownloadButton
} from './utils.js'

function hiddenAuthChoiceVars(text, escapeHtml) {
  return {
    authChoiceSectionDisplay: 'none',
    authChoicePushDisplay: 'none',
    authChoiceEmail: '',
    authChoiceEmailMasked: '',
    authChoiceDescription: '',
    authChoiceInitialToast: '',
    authChoiceInitialToastClass: 'bio-auth-toast',
    authChoiceTitle: escapeHtml(text.authChoiceTitle || ''),
    authChoicePushButton: escapeHtml(text.authChoicePushButton || ''),
    authChoiceEmailButton: escapeHtml(text.authChoiceEmailButton || '')
  }
}

function renderBioAuthSection(authRequestId, deepLinkScheme, deepLinkPath, androidPackage, noAppHintDisplay, text) {
  if (!authRequestId) return ''

  return `        <!-- 바이오 인증 (기본/권장) – 메인 인증 카드 -->
        <section class="bio-auth-section">
          <h2 class="bio-auth-title">${escapeHtml(text.bioTitle)}</h2>
          <p class="bio-auth-desc">${escapeHtml(text.bioDesc)}</p>
          <p class="bio-auth-fallback-hint" style="display: ${noAppHintDisplay};">${escapeHtml(text.bioFallbackHint)}</p>
          <button type="button" id="bioAuthCta" class="btn bio-auth-cta" data-auth-request-id="${authRequestId}" data-app-scheme="${deepLinkScheme}" data-app-path="${deepLinkPath}" data-android-package="${androidPackage}">${escapeHtml(text.bioCta)}</button>
          <div id="bioAuthToast" class="bio-auth-toast" role="status" aria-live="polite"></div>
        </section>`
}

export function renderErrorPage(status, error, errorDescription, baseUrl = '', serverInfo = null, emailAuthParams = null) {
  const authLocale = resolveAuthLocale(null, emailAuthParams?.locale || emailAuthParams?.lang || '')
  const text = getAuthText(authLocale)
  const commonVars = authTemplateVars(authLocale, escapeHtml)
  const serverSectionDisplay = serverInfo ? 'block' : 'none'
  const showEmailAuth = emailAuthParams && emailAuthParams.clientId && emailAuthParams.redirectUri
  const emailAuthSectionDisplay = showEmailAuth ? 'block' : 'none'
  const showGuideAppInstall = emailAuthSectionDisplay === 'block' ? 'none' : 'block'
  const pageHeroDisplay = 'none'
  const noAppHintDisplay = 'none'
  const bioAuthSectionDisplay = 'none'
  const authChoiceDividerDisplay = 'none'
  const emailAuthAppInstallDisplay = 'none'
  const emailAuthRequestCodeUrl = baseUrl ? `${baseUrl}/api/web/request-email-code` : ''
  return renderTemplate('auth.html', {
    ...commonVars,
    errorSectionDisplay: 'block',
    status: String(status),
    error: escapeHtml(error || 'unknown'),
    errorDescription: escapeHtml(errorDescription || text.errorDescription),
    serverSectionDisplay,
    serverAppName: serverInfo ? escapeHtml(serverInfo.appName) : '',
    serverSiteOrigin: serverInfo ? escapeHtml(serverInfo.siteOrigin) : '',
    serverHostname: serverInfo ? escapeHtml(serverInfo.hostname) : '',
    serverFaviconUrl: serverInfo && serverInfo.faviconUrl ? escapeHtml(serverInfo.faviconUrl) : '',
    serverCertificateLabel: serverInfo ? escapeHtml(serverInfo.certificateLabel) : '',
    serverCertificateStatus: serverInfo ? serverInfo.certificateStatus : '',
    serverPhishingLabel: serverInfo ? escapeHtml(serverInfo.phishingLabel) : '',
    serverPhishingStatus: serverInfo ? serverInfo.phishingStatus : 'safe',
    appDownloadAndroidButton: renderAppDownloadButton('android', authLocale),
    appDownloadIosButton: renderAppDownloadButton('ios', authLocale),
    guideStep1Image: escapeHtml(getGuideImageUrl(baseUrl, 1)),
    guideStep2Image: escapeHtml(getGuideImageUrl(baseUrl, 2)),
    guideStep3Image: escapeHtml(getGuideImageUrl(baseUrl, 3)),
    verifyEmailSectionDisplay: 'none',
    guideSectionDisplay: 'block',
    showGuideAppInstall,
    pageHeroDisplay,
    verifyEmailRequestId: '',
    verifyEmailEmail: '',
    verifyEmailRedirectUri: '',
    verifyEmailState: '',
    verifyEmailMasked: '',
    noAppHintDisplay,
    bioAuthSectionHtml: '',
    authRequestId: '',
    deepLinkScheme: '',
    deepLinkPath: '',
    androidPackage: '',
    bioAuthSectionDisplay,
    authChoiceDividerDisplay,
    emailAuthSectionDisplay,
    emailAuthTitle: escapeHtml(text.emailAuthFallbackTitle),
    emailAuthDescription: escapeHtml(text.emailAuthFallbackDescription),
    emailAuthAppInstallDisplay,
    emailAuthRequestCodeUrl: escapeHtml(emailAuthRequestCodeUrl),
    emailAuthClientId: showEmailAuth ? escapeHtml(emailAuthParams.clientId) : '',
    emailAuthRedirectUri: showEmailAuth ? escapeHtml(emailAuthParams.redirectUri) : '',
    emailAuthState: showEmailAuth ? escapeHtml(emailAuthParams.state || '') : '',
    emailAuthScope: showEmailAuth ? escapeHtml(emailAuthParams.scope || 'email,phone') : '',
    guideStep1: escapeHtml(text.guideNoApp1),
    guideStep2: escapeHtml(text.guideNoApp2),
    guideStep3: escapeHtml(text.guideConnected3),
    ...hiddenAuthChoiceVars(text, escapeHtml)
  })
}

export function renderGuidePage(ctx, serverInfo = null, options = {}) {
  const baseUrl = ctx ? resolvePublicBaseUrl(ctx) : ''
  const authLocale = resolveAuthLocale(ctx, options.authLocale || '')
  const text = getAuthText(authLocale)
  const commonVars = authTemplateVars(authLocale, escapeHtml)
  const serverSectionDisplay = serverInfo ? 'block' : 'none'
  const authMode = options.authMode === 'connected_app' ? 'connected_app'
    : options.authMode === 'choice' ? 'choice'
      : 'no_app'
  const noAppHintDisplay = options.showNoAppHint ? 'block' : 'none'
  const authRequestId = (options.authRequestId != null && String(options.authRequestId).trim()) ? String(options.authRequestId).trim() : ''
  const scheme = APP_DEEP_LINK_SCHEME || 'biopass'
  const path = APP_DEEP_LINK_PATH || 'auth'
  const packageAndroid = APP_PACKAGE_ANDROID || 'com.biopass'
  const q = ctx && ctx.request.query ? ctx.request.query : {}
  const emailAuthClientId = (q.client_id != null && String(q.client_id).trim())
    ? String(q.client_id).trim()
    : ((options.emailAuthClientId != null && String(options.emailAuthClientId).trim()) ? String(options.emailAuthClientId).trim() : '')
  const emailAuthRedirectUri = (q.redirect_uri != null && String(q.redirect_uri).trim())
    ? String(q.redirect_uri).trim()
    : ((options.emailAuthRedirectUri != null && String(options.emailAuthRedirectUri).trim()) ? String(options.emailAuthRedirectUri).trim() : '')
  const emailAuthState = (q.state != null && String(q.state).trim())
    ? String(q.state).trim()
    : ((options.emailAuthState != null && String(options.emailAuthState).trim()) ? String(options.emailAuthState).trim() : '')
  const emailAuthScope = (q.scope != null && String(q.scope).trim())
    ? String(q.scope).trim()
    : ((options.emailAuthScope != null && String(options.emailAuthScope).trim()) ? String(options.emailAuthScope).trim() : 'email,phone')
  const hasEmailAuthParams = Boolean(emailAuthClientId && emailAuthRedirectUri)
  const bioAuthSectionDisplay = authMode === 'connected_app' && authRequestId ? 'block' : 'none'
  const emailAuthSectionDisplay = (authMode !== 'choice' && hasEmailAuthParams) ? 'block' : 'none'

  // choice 모드 전용 변수
  const choiceEmail = String(options.choiceEmail || '')
  const hasPushDevice = Boolean(options.hasPushDevice)
  const authChoiceSectionDisplay = authMode === 'choice' ? 'block' : 'none'
  const authChoicePushDisplay = authMode === 'choice' && hasPushDevice ? 'block' : 'none'
  const authChoiceEmailMasked = (() => {
    if (!choiceEmail || !choiceEmail.includes('@')) return choiceEmail
    const [local, domain] = choiceEmail.split('@')
    const shown = local.length <= 2 ? local[0] : local.slice(0, 2)
    const stars = '*'.repeat(Math.min(Math.max(local.length - 2, 0), 4))
    return `${shown}${stars}@${domain}`
  })()
  const authChoiceDescription = authMode === 'choice'
    ? formatAuthText(text.authChoiceDescription, { email: authChoiceEmailMasked })
    : ''
  const authChoiceInitialToast = (() => {
    if (authMode !== 'choice' || !hasPushDevice) return ''
    if (options.autoNotificationFirebaseDisabled) return text.authChoicePushFirebaseDisabled
    if (options.autoNotificationFailed) return text.authChoicePushFailed
    if (options.autoNotificationSent) return text.authChoicePushSent
    return text.authChoicePushWaiting
  })()
  const authChoiceInitialToastClass = authChoiceInitialToast
    ? `bio-auth-toast visible ${(options.autoNotificationFailed || options.autoNotificationFirebaseDisabled) ? 'no-devices' : 'success'}`
    : 'bio-auth-toast'
  const authChoiceDividerDisplay = bioAuthSectionDisplay === 'block' && emailAuthSectionDisplay === 'block' ? 'block' : 'none'
  const bioAuthSectionHtml = bioAuthSectionDisplay === 'block'
    ? renderBioAuthSection(
      escapeHtml(authRequestId),
      escapeHtml(scheme),
      escapeHtml(path),
      escapeHtml(packageAndroid),
      noAppHintDisplay,
      text
    )
    : ''
  const emailAuthTitle = authMode === 'connected_app' ? text.emailAuthFallbackTitle : text.emailAuthPrimaryTitle
  const emailAuthDescription = authMode === 'connected_app'
    ? text.emailAuthFallbackDescription
    : text.emailAuthPrimaryDescription
  const emailAuthAppInstallDisplay = authMode === 'connected_app' ? 'none' : 'block'
  const guideStep1 = authMode === 'connected_app'
    ? text.guideConnected1
    : text.guideNoApp1
  const guideStep2 = authMode === 'connected_app'
    ? text.guideConnected2
    : text.guideNoApp2
  const guideStep3 = authMode === 'connected_app'
    ? text.guideConnected3
    : text.guideNoApp3
  const showGuideAppInstall = emailAuthSectionDisplay === 'block' ? 'none' : 'block'
  const pageHeroDisplay = 'block'
  return renderTemplate('auth.html', {
    ...commonVars,
    errorSectionDisplay: 'none',
    status: '',
    error: '',
    errorDescription: '',
    serverSectionDisplay,
    serverAppName: serverInfo ? escapeHtml(serverInfo.appName) : '',
    serverSiteOrigin: serverInfo ? escapeHtml(serverInfo.siteOrigin) : '',
    serverHostname: serverInfo ? escapeHtml(serverInfo.hostname) : '',
    serverFaviconUrl: serverInfo && serverInfo.faviconUrl ? escapeHtml(serverInfo.faviconUrl) : '',
    serverCertificateLabel: serverInfo ? escapeHtml(serverInfo.certificateLabel) : '',
    serverCertificateStatus: serverInfo ? serverInfo.certificateStatus : '',
    serverPhishingLabel: serverInfo ? escapeHtml(serverInfo.phishingLabel) : '',
    serverPhishingStatus: serverInfo ? serverInfo.phishingStatus : 'safe',
    appDownloadAndroidButton: renderAppDownloadButton('android', authLocale),
    appDownloadIosButton: renderAppDownloadButton('ios', authLocale),
    guideStep1Image: escapeHtml(getGuideImageUrl(baseUrl, 1)),
    guideStep2Image: escapeHtml(getGuideImageUrl(baseUrl, 2)),
    guideStep3Image: escapeHtml(getGuideImageUrl(baseUrl, 3)),
    verifyEmailSectionDisplay: 'none',
    guideSectionDisplay: 'block',
    showGuideAppInstall,
    verifyEmailRequestId: '',
    verifyEmailEmail: '',
    verifyEmailRedirectUri: '',
    verifyEmailState: '',
    verifyEmailMasked: '',
    pageHeroDisplay,
    noAppHintDisplay,
    bioAuthSectionHtml,
    authRequestId: escapeHtml(authRequestId),
    deepLinkScheme: escapeHtml(scheme),
    deepLinkPath: escapeHtml(path),
    androidPackage: escapeHtml(packageAndroid),
    bioAuthSectionDisplay,
    authChoiceDividerDisplay,
    emailAuthSectionDisplay,
    emailAuthTitle: escapeHtml(emailAuthTitle),
    emailAuthDescription: escapeHtml(emailAuthDescription),
    emailAuthAppInstallDisplay,
    emailAuthRequestCodeUrl: escapeHtml(`${baseUrl || ''}/api/web/request-email-code`),
    emailAuthClientId: escapeHtml(emailAuthClientId),
    emailAuthRedirectUri: escapeHtml(emailAuthRedirectUri),
    emailAuthState: escapeHtml(emailAuthState),
    emailAuthScope: escapeHtml(emailAuthScope),
    guideStep1: escapeHtml(guideStep1),
    guideStep2: escapeHtml(guideStep2),
    guideStep3: escapeHtml(guideStep3),
    authChoiceSectionDisplay,
    authChoicePushDisplay,
    authChoiceEmail: escapeHtml(choiceEmail),
    authChoiceEmailMasked: escapeHtml(authChoiceEmailMasked),
    authChoiceDescription: escapeHtml(authChoiceDescription),
    authChoiceInitialToast: escapeHtml(authChoiceInitialToast),
    authChoiceInitialToastClass: escapeHtml(authChoiceInitialToastClass),
    authChoiceTitle: escapeHtml(text.authChoiceTitle || ''),
    authChoicePushButton: escapeHtml(text.authChoicePushButton || ''),
    authChoiceEmailButton: escapeHtml(text.authChoiceEmailButton || '')
  })
}

export { getServerInfo }
