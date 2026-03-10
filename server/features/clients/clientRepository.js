const Client = require('./model')

/**
 * 클라이언트 IP 및 포트 정보 조회 (controlService + ftpService 공용)
 * ftpService는 eqpModel도 필요하므로 superset 필드를 조회
 * @param {string} eqpId - 장비 ID
 * @returns {Promise<{ipAddr: string, ipAddrL: string|null, eqpModel: string|null, agentPorts: object|null}>}
 */
async function getClientIpInfo(eqpId) {
  const client = await Client.findOne({ eqpId })
    .select('ipAddr ipAddrL eqpModel agentPorts')
    .lean()
  if (!client) {
    throw new Error(`Client not found: ${eqpId}`)
  }
  return {
    ipAddr: client.ipAddr,
    ipAddrL: client.ipAddrL || null,
    eqpModel: client.eqpModel || null,
    agentPorts: client.agentPorts || null,
  }
}

module.exports = { getClientIpInfo }
