/**
 * WebManager Logger (winston-based)
 *
 * Usage:
 *   const { createLogger } = require('../../shared/logger')
 *   const log = createLogger('category')
 *
 * Registered categories — use these strings when calling createLogger().
 * New categories should be added to this table.
 *
 * | Category       | Owner                            | Notes                            |
 * |----------------|----------------------------------|----------------------------------|
 * | server         | index.js                         | Startup, shutdown                |
 * | http           | shared/logger/httpLogger.js       | Request/response                 |
 * | db             | shared/db/connection.js           | MongoDB connections              |
 * | redis          | shared/db/redisConnection.js      | Redis connections                |
 * | rpc            | shared/avro/avroClient.js         | Avro RPC calls                   |
 * | error          | shared/middleware/errorHandler.js  | Uncaught errors                  |
 * | auth           | features/auth/                    | Login, signup, tokens            |
 * | clients        | features/clients/                 | Client mgmt, FTP, deploy, logs   |
 * | recovery       | features/recovery/                | Batch aggregation, cron          |
 * | users          | features/users/                   | User CRUD                        |
 * | permissions    | features/permissions/             | Role/feature permissions         |
 * | images         | features/images/                  | Image storage                    |
 * | os-version     | features/os-version/              | OS version list                  |
 * | exec-commands  | features/exec-commands/           | Exec command management          |
 * | email          | shared/services/emailNotification | Email delivery                   |
 * | ears           | shared/services/earsService       | EARS InterfaceServer calls       |
 * | verification   | shared/services/verificationCode  | Verification code (Redis)        |
 * | audit          | shared/models/webmanagerLogModel   | DB audit log bridge              |
 * | batch          | shared/models/webmanagerLogModel   | DB batch log bridge              |
 */

const winston = require('winston')
const path = require('path')
require('winston-daily-rotate-file')

const IS_TEST = process.env.NODE_ENV === 'test' || process.env.VITEST

const LOG_DIR = process.env.LOG_DIR
  ? path.resolve(process.env.LOG_DIR)
  : path.join(__dirname, '../../logs')

const LOG_LEVEL = process.env.LOG_LEVEL || 'info'
const LOG_MAX_SIZE = process.env.LOG_MAX_SIZE || '50m'
const LOG_MAX_DAYS = process.env.LOG_MAX_DAYS || '30d'
const LOG_COMPRESS = process.env.LOG_COMPRESS !== 'false'

/**
 * Format a log info object into the text pattern:
 *   [2026-03-19 14:30:00.123] [INFO]  [auth] message
 */
function formatLogLine(info) {
  const levelUp = info.level.toUpperCase()
  // [ERROR] has 5 chars → 1 space after bracket, [INFO] has 4 → 2 spaces
  const padAfter = levelUp.length >= 5 ? ' ' : '  '
  const category = (info.category || 'general').padEnd(13)
  return `[${info.timestamp}] [${levelUp}]${padAfter}[${category}] ${info.message}`
}

const textFormat = winston.format.printf(info => formatLogLine(info))

const timestampFormat = winston.format.timestamp({
  format: 'YYYY-MM-DD HH:mm:ss.SSS'
})

// Shared format applied at logger level (so child metadata is available)
const baseFormat = winston.format.combine(timestampFormat, textFormat)

// File transport (daily rotate) — disabled in test
let fileTransport = null
if (!IS_TEST) {
  fileTransport = new winston.transports.DailyRotateFile({
    dirname: LOG_DIR,
    filename: 'webmanager-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    maxSize: LOG_MAX_SIZE,
    maxFiles: LOG_MAX_DAYS,
    zippedArchive: LOG_COMPRESS
  })
}

// Console transport — silent in test to avoid noise
const consoleFormat = winston.format.combine(
  timestampFormat,
  winston.format.colorize({ level: true }),
  textFormat
)

const consoleTransport = new winston.transports.Console({
  silent: IS_TEST,
  format: consoleFormat
})

const transports = [consoleTransport]
if (fileTransport) transports.push(fileTransport)

const logger = winston.createLogger({
  level: LOG_LEVEL,
  format: baseFormat,
  transports
})

/**
 * Create a child logger with a specific category
 */
function createLogger(category) {
  return logger.child({ category })
}

function _getFileTransport() {
  return fileTransport
}

function _getLogDir() {
  return LOG_DIR
}

module.exports = {
  logger,
  createLogger,
  formatLogLine,
  _getFileTransport,
  _getLogDir
}
