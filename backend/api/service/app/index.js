'use strict'

import Router from 'koa-router'
import { register as registerAuthorize } from './authorize.js'
import { register as registerCheckSite } from './checkSite.js'
import { register as registerMyAuthRequests } from './myAuthRequests.js'
import { register as registerSearch } from './search.js'
import { register as registerSignup } from './signup.js'
import { register as registerStats } from './stats.js'
import { register as registerSubmitAuthResult } from './submitAuthResult.js'
import { register as registerToken } from './token.js'
import { register as registerUpdateNickname } from './updateNickname.js'
import { register as registerUpdatePushToken } from './updatePushToken.js'

const route = new Router()

registerAuthorize(route)
registerToken(route)
registerMyAuthRequests(route)
registerSubmitAuthResult(route)
registerCheckSite(route)
registerSignup(route)
registerSearch(route)
registerUpdatePushToken(route)
registerUpdateNickname(route)
registerStats(route)

export default { prefix: '/app', route }
