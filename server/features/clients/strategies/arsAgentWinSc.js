/**
 * ARS Agent (Windows SC) Strategy
 * Windows sc 명령을 사용한 서비스 관리
 */

module.exports = {
  agentGroup: 'ars_agent',
  serviceType: 'win_sc',
  isDefault: true,
  displayType: 'ars_agent',
  label: 'ARS Agent (Windows SC)',

  actions: {
    status:  { label: 'Status',     icon: 'refresh', color: 'gray',  order: 0, confirmRequired: false, disableWhen: null },
    start:   { label: 'Start',      icon: 'play',    color: 'green', order: 1, confirmRequired: false, disableWhen: 'running' },
    stop:    { label: 'Stop',       icon: 'stop',    color: 'red',   order: 2, confirmRequired: false, disableWhen: 'stopped' },
    restart: { label: 'Restart',    icon: 'refresh',  color: 'blue',  order: 3, confirmRequired: false, disableWhen: 'stopped', retries: 5, interval: 1000 },
    kill:    { label: 'Force Kill', icon: 'power',   color: 'red',   order: 4, confirmRequired: true,  disableWhen: 'stopped' },
  },

  getCommand(action) {
    const commands = {
      status:  { commandLine: 'sc', args: ['query', 'ARSAgentDummy'], timeout: 10000 },
      start:   { commandLine: 'sc', args: ['start', 'ARSAgentDummy'], timeout: 30000 },
      stop:    { commandLine: 'sc', args: ['stop', 'ARSAgentDummy'], timeout: 30000 },
      restart: null, // composite: handled by controlService
      kill:    { commandLine: 'taskkill.exe', args: ['/F', '/IM', 'arsagentdummy.exe'], timeout: 10000 },
    }
    return commands[action] || null
  },

  parseResponse(action, rpcResult) {
    // rpcResult = { success, output, error }
    switch (action) {
      case 'status':
        return this._parseScQuery(rpcResult)
      case 'start':
      case 'stop':
      case 'kill':
        return this._parseActionResult(action, rpcResult)
      default:
        return { success: rpcResult.success, message: rpcResult.output || rpcResult.error }
    }
  },

  _parseScQuery(rpcResult) {
    const output = rpcResult.output || ''

    const STATE_NAMES = 'STOPPED|START_PENDING|STOP_PENDING|RUNNING|CONTINUE_PENDING|PAUSE_PENDING|PAUSED'
    const stateMatch = output.match(new RegExp(`:\\s+([1-7])\\s+(${STATE_NAMES})`))

    const stateStr = stateMatch ? stateMatch[2] : 'UNKNOWN'
    const running = stateStr === 'RUNNING'

    return { running, state: stateStr, raw: output }
  },

  _parseActionResult(action, rpcResult) {
    return {
      success: rpcResult.success,
      message: rpcResult.success
        ? rpcResult.output || `${action} completed`
        : rpcResult.error || rpcResult.output || `${action} failed`,
    }
  },

  getDetectBasePathCommand() {
    return { commandLine: 'sc', args: ['qc', 'ARSAgent'], timeout: 10000 }
  },

  parseBasePath(rpcResult) {
    const output = rpcResult.output || ''
    const match = output.match(/BINARY_PATH_NAME\s*:\s*(.+)/)
    if (!match) {
      throw new Error('BINARY_PATH_NAME not found in sc qc output')
    }
    const binaryLine = match[1].trim()
    const binIdx = binaryLine.search(/[\\\/]bin[\\\/]/i)
    if (binIdx <= 0) {
      throw new Error(`Cannot extract basePath from: ${binaryLine}`)
    }
    return binaryLine.substring(0, binIdx).replace(/\\/g, '/')
  }
}
