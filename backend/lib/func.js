'use strict'

import moment from 'moment-timezone'
import _ from 'lodash'
import _config from '../config.js'

global._ = _

let config = ''

try {
  if (_config.timezone) {
    process.env.TZ = _config.timezone
    moment.tz.setDefault(_config.timezone)
  }
  config = process.env.config || _config
  global.config = config
} catch (e) {
  console.error('common.js start failed!!', e)
}

/** Shared bootstrap (lodash + timezone + config). Extra file helpers removed — unused in Community. */
export default { config }
