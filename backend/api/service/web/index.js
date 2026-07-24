'use strict'

import Router from 'koa-router'
import { register as registerAuthorize } from './routes/authorize.js'
import { register as registerGuide } from './routes/guide.js'
import { register as registerNotify } from './routes/notify.js'
import { register as registerRequestEmailCode } from './routes/requestEmailCode.js'
import { register as registerResendEmailCode } from './routes/resendEmailCode.js'
import { register as registerToken } from './routes/token.js'
import { register as registerVerifyEmail } from './routes/verifyEmail.js'

const route = new Router()

registerRequestEmailCode(route)
registerResendEmailCode(route)
registerNotify(route)
registerAuthorize(route)
registerGuide(route)
registerVerifyEmail(route)
registerToken(route)

export default { prefix: '/web', route }
