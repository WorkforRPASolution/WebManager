const { createLogger } = require('./index')

const httpLog = createLogger('http')

const SKIP_PATHS = ['/api/health']

/**
 * HTTP request logging middleware (morgan-style, winston-based)
 */
function httpLogger(req, res, next) {
  if (SKIP_PATHS.includes(req.originalUrl)) {
    return next()
  }

  const start = Date.now()

  res.on('finish', () => {
    const duration = Date.now() - start
    const contentLength = res.get('content-length') || '-'
    const msg = `${req.method} ${req.originalUrl} ${res.statusCode} ${contentLength} ${duration}ms`

    if (res.statusCode >= 500) {
      httpLog.error(msg)
    } else if (res.statusCode >= 400) {
      httpLog.warn(msg)
    } else {
      httpLog.http(msg)
    }
  })

  next()
}

module.exports = { httpLogger }
