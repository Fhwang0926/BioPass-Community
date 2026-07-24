'use strict'

// web 에서 호출하는 전용 api 임
import log_alarm from './log/log_alarm.js'
import log_audit from './log/log_audit.js'
import log_mail from './log/log_mail.js'
import app from './service/app/index.js'
import web from './service/web/index.js'
import sys_application from './sys/sys_application.js'
import sys_auth from './sys/sys_auth.js'
import sys_auth_log from './sys/sys_auth_log.js'
import sys_company from './sys/sys_company.js'
import sys_policy_security from './sys/sys_policy_security.js'
import sys_profile from './sys/sys_profile.js'
import sys_user from './sys/sys_user.js'
import sys_user_device from './sys/sys_user_device.js'

// app 에서 호출하는 전용 api 임

export default [
  sys_auth, sys_user, sys_company, sys_profile,
  sys_application, sys_auth_log, sys_user_device,
  sys_policy_security,
  app, web,

  log_mail, log_audit, log_alarm

]
