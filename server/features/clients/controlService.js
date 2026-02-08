const { AvroRpcClient } = require('../../shared/avro/avroClient')
const execCommandService = require('../exec-commands/service')
const Client = require('./model')
const strategyRegistry = require('./strategies')

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


async function executeRaw(eqpId, commandLine, args, timeout) {
  const { ipAddr, ipAddrL } = await getClientIpInfo(eqpId)
  const rpcClient = new AvroRpcClient(ipAddr, ipAddrL)
  try {
    await rpcClient.connect()
    const response = await rpcClient.runCommand(commandLine, args, timeout)
    return response // { success, output, error } - no throw on !success
  } finally {
    rpcClient.disconnect()
  }
}

async function executeAction(eqpId, agentGroup, action) {
  const client = await Client.findOne({ eqpId }).select('serviceType').lean()
  if (!client) throw new Error(`Client not found: ${eqpId}`)
  const strategy = client.serviceType
    ? strategyRegistry.get(agentGroup, client.serviceType)
    : strategyRegistry.getDefault(agentGroup)
  if (!strategy) throw new Error(`No strategy found for ${agentGroup}` +
    (client.serviceType ? `:${client.serviceType}` : ' (no default)'))

  // restart = stop + poll until stopped + start composite
  if (action === 'restart') {
    const retries = strategy.actions?.restart?.retries || 5
    const interval = strategy.actions?.restart?.interval || 1000

    await executeAction(eqpId, agentGroup, 'stop')

    for (let i = 0; i < retries; i++) {
      await new Promise(resolve => setTimeout(resolve, interval))
      const result = await executeAction(eqpId, agentGroup, 'status')
      if (!result.data.running) {
        return executeAction(eqpId, agentGroup, 'start')
      }
    }

    throw new Error(`Service did not stop after ${retries} retries (${retries * interval}ms)`)
  }

  const cmd = strategy.getCommand(action)
  if (!cmd) throw new Error(`No command for action: ${action}`)

  const rpcResult = await executeRaw(eqpId, cmd.commandLine, cmd.args, cmd.timeout)
  const parsed = strategy.parseResponse(action, rpcResult)

  return {
    displayType: strategy.displayType,
    action,
    data: parsed
  }
}

async function batchExecuteAction(eqpIds, agentGroup, action) {
  const results = await Promise.allSettled(
    eqpIds.map(eqpId =>
      executeAction(eqpId, agentGroup, action)
        .then(data => ({ eqpId, ...data }))
        .catch(error => ({ eqpId, error: error.message }))
    )
  )
  return results.map(r => r.status === 'fulfilled' ? r.value : { eqpId: 'unknown', error: r.reason?.message })
}

async function batchExecuteActionStream(eqpIds, agentGroup, action, onProgress) {
  const total = eqpIds.length
  let completed = 0
  const concurrency = parseInt(process.env.BATCH_CONCURRENCY) || 5

  const pool = eqpIds.map((eqpId) => async () => {
    try {
      const result = await executeAction(eqpId, agentGroup, action)
      completed++

      if (action !== 'status') {
        // For control actions, follow up with status to get running/state
        try {
          const statusResult = await executeAction(eqpId, agentGroup, 'status')
          onProgress({ eqpId, ...statusResult, completed, total })
        } catch (statusError) {
          // If status query fails, send the original control result
          onProgress({ eqpId, ...result, completed, total })
        }
      } else {
        onProgress({ eqpId, ...result, completed, total })
      }
    } catch (error) {
      completed++
      onProgress({ eqpId, error: error.message, completed, total })
    }
  })

  // concurrency pool execution (same pattern as ftpService.deployConfig)
  const executing = new Set()
  for (const task of pool) {
    const p = task().then(() => executing.delete(p))
    executing.add(p)
    if (executing.size >= concurrency) await Promise.race(executing)
  }
  await Promise.all(executing)
}

module.exports = {
  getClientStatus,
  startClient,
  stopClient,
  restartClient,
  executeCommand,
  getClientIpInfo,
  getBatchClientStatus,
  executeRaw,
  executeAction,
  batchExecuteAction,
  batchExecuteActionStream
}
