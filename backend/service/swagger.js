'use strict'

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import chalk from 'chalk'
import yaml from 'js-yaml'
import { koaSwagger } from 'koa2-swagger-ui'
import swaggerJSDoc from 'swagger-jsdoc'
import config from '../config.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const docsDir = path.join(__dirname, '..', 'docs')

function loadYamlPaths(filename) {
  const filePath = path.join(docsDir, filename)
  if (!fs.existsSync(filePath)) return {}
  const content = fs.readFileSync(filePath, 'utf8')
  const doc = yaml.load(content)
  return doc?.paths || {}
}

// backend/api/service (app, web) API만 Swagger에 표시.
const swaggerOptions = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'BioPass API',
      version: '1.0.0',
      description: '연동 API(/api/app, /api/web) 문서. 공통 응답: `{ result: true, message?, data }`. 목록: `data: { data: [], pagination }`.'
    },
    servers: [
      {
        url: `http://localhost:${config.web.port}`,
        description: 'Development server'
      }
    ],
    tags: [
      { name: 'Service (App)', description: '연동 API - /api/app. 앱에서 사용. OAuth, 인증 요청 조회/제출, 회원가입(인증코드), 사이트 연동 확인, 앱 목록 검색. 애플리케이션 생성/수정/삭제는 없음(관리 콘솔에서만 가능).' },
      { name: 'Service (Web)', description: '연동 API - /api/web. 웹에서 인증하기 위한 API. 이메일 인증 코드 요청/재발송/검증, OAuth 인증·토큰·토큰 검증, 가이드 페이지, 인증 요청 알림.' }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: '로그인 후 받은 JWT 토큰을 입력하세요'
        }
      },
      schemas: {
        Pagination: {
          type: 'object',
          properties: {
            page: { type: 'integer', description: '현재 페이지' },
            limit: { type: 'integer', description: '페이지당 항목 수' },
            total: { type: 'integer', description: '전체 개수' },
            totalPages: { type: 'integer', description: '전체 페이지 수' }
          }
        },
        ApiResponse: {
          type: 'object',
          properties: {
            result: { type: 'boolean', description: '성공 여부' },
            message: { type: 'string', description: '메시지' },
            data: { type: 'object', description: '단일 리소스 응답 시 엔티티 객체' }
          }
        },
        ApiListResponse: {
          type: 'object',
          properties: {
            result: { type: 'boolean', description: '성공 여부' },
            message: { type: 'string', description: '메시지' },
            data: {
              type: 'object',
              properties: {
                data: { type: 'array', items: { type: 'object' }, description: '목록' },
                pagination: { $ref: '#/components/schemas/Pagination' }
              }
            }
          }
        }
      }
    }
  },
  security: [{ bearerAuth: [] }],
  apis: []
}

const baseSpec = swaggerJSDoc(swaggerOptions)

function buildSwaggerSpec() {
  const appPaths = loadYamlPaths('service_app.yaml')
  const webPaths = loadYamlPaths('service_web.yaml')
  return {
    ...baseSpec,
    paths: { ...(baseSpec.paths || {}), ...appPaths, ...webPaths }
  }
}

// 요청 시마다 YAML을 다시 읽어 최신 문서 반영 (docs 수정 후 재시작 불필요)
let swaggerSpec = buildSwaggerSpec()

export default (app, router) => {
  const opt = {
    routePrefix: '/api-docs',
    swaggerOptions: {
      url: '/swagger.json',
      persistAuthorization: true,
      docExpansion: 'list',
      filter: true,
      tryItOutEnabled: true
    }
  }

  app.use(koaSwagger(opt))

  router.get(opt.swaggerOptions.url, (ctx) => {
    ctx.set('Content-Type', 'application/json')
    swaggerSpec = buildSwaggerSpec()
    ctx.body = swaggerSpec
  })

  for (const s of swaggerOptions.definition.servers) {
    console.log(chalk.yellow(`Swagger UI: ${s.url}${opt.routePrefix}`))
  }

  return [app, router]
}
