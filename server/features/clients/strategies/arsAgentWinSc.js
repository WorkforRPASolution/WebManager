/**
 * ARS Agent (Windows SC) Strategy
 * Windows sc 명령을 사용한 서비스 관리
 */

module.exports = {
  id: 'ars_agent_win_sc',
  displayType: 'ars_agent',
  label: 'ARS Agent (Windows SC)',

  actions: {
    status:  { label: 'Status',     icon: 'refresh', color: 'gray',  order: 0, confirmRequired: false, disableWhen: null },
    start:   { label: 'Start',      icon: 'play',    color: 'green', order: 1, confirmRequired: false, disableWhen: 'running' },
    stop:    { label: 'Stop',       icon: 'stop',    color: 'red',   order: 2, confirmRequired: false, disableWhen: 'stopped' },
    restart: { label: 'Restart',    icon: 'refresh',  color: 'blue',  order: 3, confirmRequired: false, disableWhen: 'stopped' },
    kill:    { label: 'Force Kill', icon: 'power',   color: 'red',   order: 4, confirmRequired: true,  disableWhen: 'stopped' },
  },

  getCommand(action) {
    const commands = {
      status:  { commandLine: 'sc', args: ['query', 'ARSAgent'], timeout: 10000 },
      start:   { commandLine: 'sc', args: ['start', 'ARSAgent'], timeout: 30000 },
      stop:    { commandLine: 'sc', args: ['stop', 'ARSAgent'], timeout: 30000 },
      restart: null, // composite: handled by controlService
      kill:    { commandLine: 'taskkill.exe', args: ['/F', '/IM', 'earsagent.exe'], timeout: 10000 },
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
    const stateMatch = output.match(/STATE\s+:\s+\d+\s+(\w+)/)
    const pidMatch = output.match(/PID\s+:\s+(\d+)/)

    const stateStr = stateMatch ? stateMatch[1] : 'UNKNOWN'
    const running = stateStr === 'RUNNING'
    const pid = pidMatch ? parseInt(pidMatch[1]) : null

    return {
      running,
      state: stateStr,
      pid: running ? pid : null,
      raw: output
    }
  },

  _parseActionResult(action, rpcResult) {
    return {
      success: rpcResult.success,
      message: rpcResult.success
        ? rpcResult.output || `${action} completed`
        : rpcResult.error || rpcResult.output || `${action} failed`,
    }
  }
}
