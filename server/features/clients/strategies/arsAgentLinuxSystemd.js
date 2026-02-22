/**
 * ARS Agent (Linux Systemd) Strategy
 * systemctl 명령을 사용한 서비스 관리
 *
 * [Service Control] actions + getCommand(action) + parseResponse(action, result)
 *   - controlService.executeAction()에서 호출
 *   - action 문자열 하나로 고정 커맨드 반환 → 통일된 {running, state} 응답 파싱
 *
 * [Log Tail] getTailCommand(filePath, lines, basePath)
 *   - logService.js에서 호출 — 런타임 인자(파일경로, 줄 수)가 필요하여 별도 메서드
 *
 * [BasePath Detection] getDetectBasePathCommand() + parseBasePath(rpcResult)
 *   - controlService.detectBasePath()에서 호출 — 반환 형식(단순 문자열)이 parseResponse와 다름
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
      kill:    { commandLine: 'systemctl', args: ['kill', '-s', 'SIGKILL', 'ARSAgent'], timeout: 10000 },
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

  // --- Log Tail (logService.js) ---
  getTailCommand(filePath, lines, basePath) {
    return { commandLine: 'tail', args: ['-n', String(lines), filePath], timeout: 10000 }
  },

  // --- BasePath Detection (controlService.js) ---
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
  },

  // --- List Files (configTestController.js) ---
  getListFilesCommand(directory) {
    return {
      commandLine: 'find',
      args: [directory, '-maxdepth', '1', '-type', 'f', '-printf', '%f\\t%s\\t%T@\\n'],
      timeout: 15000
    }
  },

  parseListFilesResponse(rpcResult) {
    if (!rpcResult.success) {
      const combined = (rpcResult.output || '') + ' ' + (rpcResult.error || '')
      if (/no such file or directory/i.test(combined))
        return { files: [], error: '디렉토리를 찾을 수 없습니다' }
      throw new Error(rpcResult.error || 'List files command failed')
    }
    const output = (rpcResult.output || '').trim()
    if (!output) return { files: [] }
    return {
      files: output.split('\n').filter(l => l.trim()).map(line => {
        const [name, size, epoch] = line.split('\t')
        return { name, size: parseInt(size) || 0, modifiedAt: epoch ? new Date(parseFloat(epoch) * 1000).toISOString() : null }
      })
    }
  }

}
