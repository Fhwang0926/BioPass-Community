'use strict'

// Export schemas as models for backward compatibility
import * as schemas from './drizzle-schema.js'

// Export Drizzle schemas
export * from './drizzle-schema.js'

export default {
  sys_user: schemas.sysUser,
  sys_company: schemas.sysCompany,
  sys_application: schemas.sysApplication,
  log_alarm: schemas.logAlarm,
  log_audit: schemas.logAudit,
  log_mail: schemas.logMail,
  auth_requests: schemas.authRequests,
  sys_apps: schemas.apps,
  users: schemas.users,
  auth_events: schemas.authEvents,
  auth_codes: schemas.authCodes,
  auth_devices: schemas.devices,
  service_security_policies: schemas.securityPolicies,
  service_risk_events: schemas.riskEvents
}
