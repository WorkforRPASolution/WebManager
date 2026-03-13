/**
 * Config Compare Service
 * Parallel FTP config reading for N-way comparison
 */

let ftpServiceModule = require('./ftpService')
let runConcurrentlyFn = require('../../shared/utils/concurrencyPool').runConcurrently

let deps = {
  ftpService: ftpServiceModule,
  runConcurrently: runConcurrentlyFn
}

/** @internal Replace dependencies for testing */
function _setDeps(overrides) {
  deps = { ...deps, ...overrides }
}

/**
 * N개 클라이언트의 config를 병렬 FTP로 읽고 SSE progress 콜백 호출
 * @param {string[]} eqpIds
 * @param {string} agentGroup
 * @param {function} onProgress - ({ type, eqpId, status, configs?, error? }) => void
 * @param {number} concurrency
 */
async function compareConfigs(eqpIds, agentGroup, onProgress, concurrency = 5) {
  if (!eqpIds || eqpIds.length < 2) {
    throw new Error('eqpIds must contain at least 2 items')
  }

  await deps.runConcurrently(eqpIds, async (eqpId) => {
    try {
      const configs = await deps.ftpService.readAllConfigs(eqpId, agentGroup)
      onProgress({
        type: 'progress',
        eqpId,
        status: 'loaded',
        configs
      })
    } catch (err) {
      onProgress({
        type: 'progress',
        eqpId,
        status: 'error',
        error: err.message
      })
    }
  }, concurrency)
}

module.exports = {
  compareConfigs,
  _setDeps
}
