const { AvroRpcClient } = require('../../shared/avro/avroClient')
const execCommandService = require('../exec-commands/service')
const Client = require('./model')

/**
 * 클라이언트 IP 정보 조회
 * @param {string} eqpId - 장비 ID
 * @returns {Promise<{ipAddr: string, ipAddrL: string|null}>}
 */
async function getClientIpInfo(eqpId) {
  const client = await Client.findOne({ eqpId }).select('ipAddr ipAddrL').lean()
  if (!client) {
    throw new Error(`Client not found: ${eqpId}`)
  }
  return {
    ipAddr: client.ipAddr,
    ipAddrL: client.ipAddrL || null
  }
}

/**
 * DB에서 명령어 조회 후 RPC 실행
 * @param {string} eqpId - 장비 ID
 * @param {string} commandId - service_start|service_stop|service_status|service_restart
 * @returns {Promise<object>} - processctl의 JSON 출력 파싱 결과
 */
async function executeCommand(eqpId, commandId) {
  // 1. DB에서 명령어 조회
  const cmd = await execCommandService.getCommand(commandId)
  if (!cmd) {
    throw new Error(`Command not found: ${commandId}`)
  }

  // 2. 클라이언트 IP 정보 조회
  const { ipAddr, ipAddrL } = await getClientIpInfo(eqpId)

  // 3. RPC 클라이언트 생성 (ipAddrL이 있으면 SOCKS proxy 경유)
  const rpcClient = new AvroRpcClient(ipAddr, ipAddrL)

  try {
    // 4. 연결
    await rpcClient.connect()

    // 5. DB에서 조회한 값으로 명령 실행
    const response = await rpcClient.runCommand(cmd.commandLine, cmd.args, cmd.timeout)

    if (!response.success) {
      throw new Error(response.error || 'RPC call failed')
    }

    // 6. 결과 파싱
    return JSON.parse(response.output)
  } finally {
    rpcClient.disconnect()
  }
}

/**
 * 클라이언트 서비스 상태 확인
 * @param {string} eqpId - 장비 ID
 * @returns {Promise<{running: boolean, pid: number|null, uptime: string|null}>}
 */
async function getClientStatus(eqpId) {
  return executeCommand(eqpId, 'service_status')
}

/**
 * 클라이언트 서비스 시작
 * @param {string} eqpId - 장비 ID
 * @returns {Promise<{success: boolean, message: string, pid: number}>}
 */
async function startClient(eqpId) {
  return executeCommand(eqpId, 'service_start')
}

/**
 * 클라이언트 서비스 종료
 * @param {string} eqpId - 장비 ID
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function stopClient(eqpId) {
  return executeCommand(eqpId, 'service_stop')
}

/**
 * 클라이언트 서비스 재시작
 * @param {string} eqpId - 장비 ID
 * @returns {Promise<{success: boolean, message: string, pid: number}>}
 */
async function restartClient(eqpId) {
  return executeCommand(eqpId, 'service_restart')
}


/**
 * 여러 클라이언트의 서비스 상태를 병렬 조회
 * @param {string[]} eqpIds - 장비 ID 배열
 * @returns {Promise<Object>} - { [eqpId]: { running, pid, uptime } | { error: message } }
 */
async function getBatchClientStatus(eqpIds) {
  const results = await Promise.allSettled(
    eqpIds.map(eqpId => getClientStatus(eqpId).then(status => ({ eqpId, status })))
  )

  const statusMap = {}
  for (const result of results) {
    if (result.status === 'fulfilled') {
      const { eqpId, status } = result.value
      statusMap[eqpId] = status
    } else {
      // Extract eqpId from the error context
      const match = result.reason?.message?.match(/Client not found: (.+)/)
      const eqpId = match ? match[1] : null
      if (eqpId) {
        statusMap[eqpId] = { error: result.reason.message }
      }
    }
  }

  // Fill in any missing eqpIds with error status
  for (const eqpId of eqpIds) {
    if (!statusMap[eqpId]) {
      statusMap[eqpId] = { error: 'Failed to get status' }
    }
  }

  return statusMap
}

module.exports = {
  getClientStatus,
  startClient,
  stopClient,
  restartClient,
  executeCommand,
  getClientIpInfo,
  getBatchClientStatus
}
