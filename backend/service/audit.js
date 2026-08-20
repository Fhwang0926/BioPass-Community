'use strict'

import _ from 'lodash'
import { sql } from '../lib/index.js'

/**
 * 문자열을 최대 길이로 제한하는 헬퍼 함수
 * @param {string} str - 제한할 문자열
 * @param {number} maxLength - 최대 길이 (기본값: 150)
 * @returns {string} - 제한된 문자열
 */
const truncateString = (str, maxLength = 150) => {
  if (!str || typeof str !== 'string') return str
  if (str.length <= maxLength) return str
  return str.substring(0, maxLength) + '... (truncated)'
}

/**
 * 객체를 재귀적으로 순회하며 문자열 값이 maxLength를 넘으면 자르기
 * @param {any} obj - 처리할 객체
 * @param {number} maxLength - 최대 길이 (기본값: 150)
 * @returns {any} - 처리된 객체
 */
const truncateObjectValues = (obj, maxLength = 150) => {
  if (obj == null) return obj

  // 배열인 경우
  if (Array.isArray(obj)) {
    return obj.map(item => truncateObjectValues(item, maxLength))
  }

  // 객체인 경우 (Date / RegExp 등은 그대로)
  if (typeof obj === 'object') {
    if (obj instanceof Date || obj instanceof RegExp) return obj
    const truncated = Object.create(null)
    for (const [key, value] of Object.entries(obj)) {
      // Block prototype-pollution keys; only copy plain identifier-like properties.
      if (typeof key !== 'string' || !/^[A-Za-z0-9_.-]+$/.test(key)) continue
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue
      if (typeof value === 'string') {
        truncated[key] = truncateString(value, maxLength)
      } else if (typeof value === 'object' && value !== null) {
        truncated[key] = truncateObjectValues(value, maxLength)
      } else {
        truncated[key] = value
      }
    }
    return truncated
  }

  // 원시 타입은 그대로 반환
  return obj
}

/**
 * 객체나 문자열을 JSON 문자열로 변환하고 길이 제한
 * JSON 파싱 가능한 경우 각 키의 값을 개별적으로 확인하여 150자를 넘는 값만 자름
 * @param {any} data - 변환할 데이터
 * @param {number} maxLength - 최대 길이 (기본값: 150)
 * @returns {string|null} - 제한된 JSON 문자열
 */
const stringifyAndTruncate = (data, maxLength = 150) => {
  if (!data) return null

  try {
    let parsedData

    // 문자열인 경우 JSON 파싱 시도
    if (typeof data === 'string') {
      try {
        parsedData = JSON.parse(data)
      } catch (parseError) {
        // JSON 파싱 실패 시 문자열 그대로 처리
        return truncateString(data, maxLength)
      }
    } else {
      // 이미 객체인 경우
      parsedData = data
    }

    // 객체의 각 값이 maxLength를 넘는지 확인하고 자르기
    const truncatedData = truncateObjectValues(parsedData, maxLength)

    // 다시 JSON 문자열로 변환
    return JSON.stringify(truncatedData)
  } catch (error) {
    // 에러 발생 시 기존 방식대로 처리
    try {
      const jsonString = typeof data === 'string' ? data : JSON.stringify(data)
      return truncateString(jsonString, maxLength)
    } catch (stringifyError) {
      return truncateString(String(data), maxLength)
    }
  }
}

/**
 * log_audit용 user id 분리: user_id는 integer(관리자), app_user_id는 text(앱 사용자 usr_xxx)
 * @param {string|number} id - ctx.request.profile.id
 * @returns {{ auditUserId: number|null, auditAppUserId: string|null }}
 */
function resolveAuditUserIds(id) {
  if (id == null) return { auditUserId: null, auditAppUserId: null }
  if (typeof id === 'number' && Number.isInteger(id)) return { auditUserId: id, auditAppUserId: null }
  const s = String(id)
  if (/^\d+$/.test(s)) return { auditUserId: parseInt(s, 10), auditAppUserId: null }
  if (s.startsWith('usr_')) return { auditUserId: null, auditAppUserId: s }
  return { auditUserId: null, auditAppUserId: null }
}

/**
 * API 응답을 감사 로그로 기록
 * @param {Object} ctx - Koa context
 * @param {string} action - 액션 이름
 * @param {string} status - 상태 (success/failed)
 * @param {string} description - 설명
 * @param {Object} responseBody - 응답 본문
 * @returns {Promise<void>}
 */
export const logApiResponse = async (ctx, action, status, description = null, responseBody = null) => {
  try {
    const user = ctx.request.profile
    const requestBody = ctx.request.body

    // 민감한 정보 제거
    const sanitizedRequestBody = requestBody ? _.omit(requestBody, ['password', 'password_new']) : null
    const sanitizedResponseBody = responseBody ? (typeof responseBody === typeof ('') ? responseBody : _.omit(responseBody, ['password', 'token'])) : null

    // 문자열 길이 제한 (150자)
    const MAX_LENGTH = 150
    const truncatedDescription = truncateString(description, MAX_LENGTH)
    const truncatedRequestBody = stringifyAndTruncate(sanitizedRequestBody, MAX_LENGTH)
    const truncatedResponseBody = stringifyAndTruncate(sanitizedResponseBody, MAX_LENGTH)
    const truncatedUserAgent = truncateString(ctx.request.headers['user-agent'], MAX_LENGTH)

    const { auditUserId, auditAppUserId } = resolveAuditUserIds(user?.id)

    await sql.db.insert(sql.schema.logAudit).values({
      userId: auditUserId,
      appUserId: auditAppUserId,
      action,
      status,
      description: truncatedDescription,
      requestPath: ctx.request.path,
      requestMethod: ctx.request.method,
      requestBody: truncatedRequestBody,
      responseBody: truncatedResponseBody,
      ipAddress: ctx.request.ip,
      userAgent: truncatedUserAgent,
      responseTime: Date.now() - ctx.request.start_time
    }).returning()
  } catch (error) {
    console.error('Audit log error:', error)
    // 감사 로그 실패는 애플리케이션 로직에 영향을 주지 않도록 함
    // 재시도: 데이터를 더 짧게 잘라서 다시 시도
    try {
      const user = ctx.request.profile
      const requestBody = ctx.request.body

      const sanitizedRequestBody = requestBody ? _.omit(requestBody, ['password', 'password_new']) : null
      const sanitizedResponseBody = responseBody ? (typeof responseBody === typeof ('') ? responseBody : _.omit(responseBody, ['password', 'token'])) : null

      // 더 짧게 자르기 (100자)
      const SHORT_LENGTH = 100
      const shortDescription = truncateString(description, SHORT_LENGTH)
      const shortRequestBody = stringifyAndTruncate(sanitizedRequestBody, SHORT_LENGTH)
      const shortResponseBody = stringifyAndTruncate(sanitizedResponseBody, SHORT_LENGTH)
      const shortUserAgent = truncateString(ctx.request.headers['user-agent'], SHORT_LENGTH)

      const { auditUserId, auditAppUserId } = resolveAuditUserIds(user?.id)

      await sql.db.insert(sql.schema.logAudit).values({
        userId: auditUserId,
        appUserId: auditAppUserId,
        action,
        status,
        description: shortDescription,
        requestPath: ctx.request.path,
        requestMethod: ctx.request.method,
        requestBody: shortRequestBody,
        responseBody: shortResponseBody,
        ipAddress: ctx.request.ip,
        userAgent: shortUserAgent,
        responseTime: Date.now() - ctx.request.start_time
      }).returning()
    } catch (retryError) {
      console.error('Audit log retry error:', retryError)
    }
  }
}

/**
 * 성공 응답을 감사 로그로 기록
 * @param {Object} ctx - Koa context
 * @param {string} action - 액션 이름
 * @param {string} description - 설명
 * @param {Object} responseBody - 응답 본문
 * @returns {Promise<void>}
 */
export const logSuccess = async (ctx, action, description = null, responseBody = null, logging = true) => {
  if (logging) {
    let body = null

    if (responseBody) {
      body = Object.assign({}, responseBody)

      if (responseBody.data?.rows && Array.isArray(responseBody.data.rows) && responseBody.data.rows.length > 0) {
        body = JSON.parse(JSON.stringify(body))
        body.data.rows = JSON.parse(JSON.stringify(responseBody.data.rows)).map(x => x.id)
      }
    }

    await logApiResponse(ctx, action, 'success', description, body)
  }
  return {
    result: true,
    message: responseBody ? description : '',
    data: responseBody
  }
}

/**
 * 실패 응답을 감사 로그로 기록
 * @param {Object} ctx - Koa context
 * @param {string} action - 액션 이름
 * @param {string} description - 설명 (감사 로그 / 폴백 메시지)
 * @param {string|Error|{message?: string, code?: string}|null} errorOrDetail - 상세 사유 또는 코드
 * @param {boolean} logging - 감사 로그 기록 여부
 * @returns {Promise<{result: false, message: string, code?: string, data: string}>}
 */
export const logFailure = async (ctx, action, description = null, errorOrDetail = null, logging = true) => {
  let detailMessage = ''
  let code

  if (typeof errorOrDetail === 'string') {
    detailMessage = errorOrDetail
  } else if (errorOrDetail && typeof errorOrDetail === 'object') {
    detailMessage = errorOrDetail.message || String(errorOrDetail)
    code = errorOrDetail.code
  }

  if (logging) {
    await logApiResponse(
      ctx,
      action,
      'failed',
      description,
      detailMessage || (typeof errorOrDetail === 'string' ? errorOrDetail : errorOrDetail?.message)
    )
  }
  console.error(errorOrDetail)
  const body = {
    result: false,
    // Prefer concrete detail for clients; fall back to audit description
    message: detailMessage || description || '',
    data: '' // 보안 이슈
  }
  if (code) body.code = code
  return body
}

/**
 * 미들웨어: API 요청/응답을 자동으로 감사 로그로 기록
 * @returns {Function} Koa middleware
 */
export const auditMiddleware = () => {
  return async (ctx, next) => {
    const startTime = Date.now()
    const originalBody = ctx.body

    try {
      await next()

      // 응답 시간 계산
      const responseTime = Date.now() - startTime

      // 성공 응답 로깅
      await logSuccess(
        ctx,
        `${ctx.request.method}_${ctx.request.path}`,
        `Response time: ${responseTime}ms`,
        originalBody
      )
    } catch (error) {
      // 실패 응답 로깅
      await logFailure(
        ctx,
        `${ctx.request.method}_${ctx.request.path}`,
        error.message,
        { error: error.message }
      )
      throw error
    }
  }
}
