const os = require('os')

/**
 * Returns the pod/instance identifier.
 * In Kubernetes: POD_NAME env var (set via Downward API).
 * In development: os.hostname().
 */
function getPodId() {
  return process.env.POD_NAME || os.hostname()
}

module.exports = { getPodId }
