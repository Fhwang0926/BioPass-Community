'use strict'

import send from 'koa-send'
import { GUIDE_IMAGES_DIR, ALLOWED_GUIDE_IMAGES } from '../constants.js'
import { renderGuidePage } from '../render.js'

export function register(route) {
  route.get('/guide', (ctx) => {
    ctx.type = 'text/html'
    ctx.body = renderGuidePage(ctx)
  })

  route.get('/guide/images/:name', async (ctx) => {
    const name = ctx.params.name
    if (!ALLOWED_GUIDE_IMAGES.includes(name)) {
      ctx.status = 404
      return
    }
    await send(ctx, name, { root: GUIDE_IMAGES_DIR })
  })
}
