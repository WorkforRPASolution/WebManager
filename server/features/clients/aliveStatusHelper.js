const { getBatchAliveStatus } = require('./agentAliveService')
const { getBatchAgentVersions } = require('./agentVersionService')

let deps = {}
function _setDeps(d) { deps = d }

function getAlive() {
  return deps.getBatchAliveStatus || getBatchAliveStatus
}
function getVersions() {
  return deps.getBatchAgentVersions || getBatchAgentVersions
}

/**
 * Alive status + Agent version을 한 번에 조회 후 병합
 * controller.js의 2곳 중복 로직을 통합
 */
async function getAliveStatusWithVersions(eqpIds, agentGroup) {
  const [statuses, versions] = await Promise.all([
    getAlive()(eqpIds, agentGroup),
    getVersions()(eqpIds),
  ])

  for (const eqpId of Object.keys(statuses)) {
    statuses[eqpId].agentVersion = versions[eqpId] || { arsAgent: null, resourceAgent: null }
  }

  return statuses
}

module.exports = { getAliveStatusWithVersions, _setDeps }
