'use strict'

import fs from 'fs'
import admin from 'firebase-admin'
import config from '../config.js'

let initialized = false

// Docker Config 마운트 경로 우선, 없으면 config.js의 경로 사용
const serviceAccountPath =
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
  config.json?.firebaseServiceAccountPath ||
  '/run/configs/firebase-service-account'

try {
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'))
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
  initialized = true
  console.log('[firebase] 초기화 성공 | project:', serviceAccount.project_id, '| client_email:', serviceAccount.client_email)
} catch (err) {
  console.warn('[firebase] init failed (path: %s):', serviceAccountPath, err?.message)
}

export { admin }
export const isFirebaseInitialized = () => initialized
