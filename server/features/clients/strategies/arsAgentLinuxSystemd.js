/**
 * ARS Agent (Linux Systemd) Strategy
 * systemctl 명령을 사용한 서비스 관리
 */

module.exports = {
  agentGroup: 'ars_agent',
  serviceType: 'linux_systemd',
  isDefault: false,
  displayType: 'ars_agent',
  label: 'ARS Agent (Linux Systemd)',

  actions: {
    status:  { label: 'Status',     icon: 'refresh', color: 'gray',  order: 0, confirmRequired: false, disableWhen: null },
    start:   { label: 'Start',      icon: 'play',    color: 'green', order: 1, confirmRequired: false, disableWhen: 'running' },
    stop:    { label: 'Stop',       icon: 'stop',    color: 'red',   order: 2, confirmRequired: false, disableWhen: 'stopped' },
    restart: { label: 'Restart',    icon: 'refresh',  color: 'blue',  order: 3, confirmRequired: false, disableWhen: 'stopped', retries: 5, interval: 1000 },
    kill:    { label: 'Force Kill', icon: 'power',   color: 'red',   order: 4, confirmRequired: true,  disableWhen: 'stopped' },
  },

  getCommand(action) {
    const commands = {
      status:  { commandLine: 'systemctl', args: ['status', 'ARSAgent'], timeout: 10000 },
      start:   { commandLine: 'systemctl', args: ['start', 'ARSAgent'], timeout: 30000 },
      stop:    { commandLine: 'systemctl', args: ['stop', 'ARSAgent'], timeout: 30000 },
      restart: null, // composite: handled by controlService
      kill:    { commandLine: 'kill', args: ['-9', '$(pgrep -f ARSAgent)'], timeout: 10000 },
    }
    return commands[action] || null
  },

  parseResponse(action, rpcResult) {
    switch (action) {
      case 'status':
        return this._parseSystemctlStatus(rpcResult)
      case 'start':
      case 'stop':
      case 'kill':
        return this._parseActionResult(action, rpcResult)
      default:
        return { success: rpcResult.success, message: rpcResult.output || rpcResult.error }
    }
  },

  _parseSystemctlStatus(rpcResult) {
    const output = rpcResult.output || ''
    const running = /Active:\s+active\s+\(running\)/i.test(output)
    const stopped = /Active:\s+inactive|Active:\s+failed/i.test(output)
    const stateStr = running ? 'RUNNING' : (stopped ? 'STOPPED' : 'UNKNOWN')

    // Extract PID from systemctl output
    const pidMatch = output.match(/Main PID:\s+(\d+)/)
    const pid = pidMatch ? parseInt(pidMatch[1]) : 0

    return { running, state: stateStr, pid, raw: output }
  },

  _parseActionResult(action, rpcResult) {
    return {
      success: rpcResult.success,
      message: rpcResult.success
        ? rpcResult.output || `${action} completed`
        : rpcResult.error || rpcResult.output || `${action} failed`,
    }
  },

  getTailCommand(filePath, lines) {
    return { commandLine: 'tail', args: ['-n', String(lines), filePath], timeout: 10000 }
  },

  getDetectBasePathCommand() {
    return { commandLine: 'systemctl', args: ['show', 'ARSAgent', '-p', 'ExecStart'], timeout: 10000 }
  },

  parseBasePath(rpcResult) {
    const output = rpcResult.output || ''
    // ExecStart 라인에서 실행 경로 추출
    // Format: ExecStart={ path=/opt/ARSAgent/bin/start.sh ; ... }
    const match = output.match(/path=([^\s;]+)/)
    if (!match) {
      throw new Error('ExecStart path not found in systemctl show output')
    }
    const binaryPath = match[1].trim()
    const binIdx = binaryPath.search(/[\\\/]bin[\\\/]/i)
    if (binIdx <= 0) {
      throw new Error(`Cannot extract basePath from: ${binaryPath}`)
    }
    return binaryPath.substring(0, binIdx)
  }
}
