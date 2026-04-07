const os = require('os')

/**
 * Returns the pod/instance identifier.
 * Priority:
 * 1. POD_NAME env var (Kubernetes Downward API — guaranteed unique per pod)
 * 2. os.hostname() + pid suffix (development fallback — avoids collision when multiple
 *    Node processes run on the same host with identical hostname, e.g., docker-compose scale)
 */
function getPodId() {
  if (process.env.POD_NAME) return process.env.POD_NAME
  return `${os.hostname()}-${process.pid}`
}

module.exports = { getPodId }
