/**
 * Resource Agent (Windows SC) Strategy
 * net 명령 (start/stop), sc 명령 (status)을 사용한 서비스 관리
 *
 * [Service Control] actions + getCommand(action) + parseResponse(action, result)
 *   - controlService.executeAction()에서 호출
 *   - action 문자열 하나로 고정 커맨드 반환 → 통일된 {running, state} 응답 파싱
 *   - start/stop: net 명령 사용 (동기 — 실제 상태 변경까지 대기)
 *   - status: sc query 사용
 *
 * [Log Tail] getTailCommand(filePath, lines, basePath, offset)
 *   - logService.js에서 호출 — 런타임 인자(파일경로, 줄 수)가 필요하여 별도 메서드
 */

module.exports = {
  agentGroup: 'resource_agent',
  serviceType: 'win_sc',
  isDefault: true,
  displayType: 'resource_agent',
  label: 'Resource Agent (Windows SC)',

  actions: {
    status:  { label: 'Status',     icon: 'refresh', color: 'gray',  order: 0, confirmRequired: false, disableWhen: null },
    start:   { label: 'Start',      icon: 'play',    color: 'green', order: 1, confirmRequired: false, disableWhen: 'running' },
    stop:    { label: 'Stop',       icon: 'stop',    color: 'red',   order: 2, confirmRequired: false, disableWhen: 'stopped' },
    restart: { label: 'Restart',    icon: 'refresh',  color: 'blue',  order: 3, confirmRequired: false, disableWhen: 'stopped', retries: 3, interval: 2000 },
    kill:    { label: 'Force Kill', icon: 'power',   color: 'red',   order: 4, confirmRequired: true,  disableWhen: 'stopped' },
  },

  getCommand(action) {
    const commands = {
      status:  { commandLine: 'sc', args: ['query', 'ResourceAgent'], timeout: 10000 },
      start:   { commandLine: 'net', args: ['start', 'ResourceAgent'], timeout: 45000 },
      stop:    { commandLine: 'net', args: ['stop', 'ResourceAgent'], timeout: 45000 },
      restart: null, // composite: handled by controlService
      kill:    { commandLine: 'taskkill.exe', args: ['/F', '/IM', 'resourceagent.exe'], timeout: 10000 },
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
        return this._parseNetResult(action, rpcResult)
      case 'kill':
        return this._parseActionResult(action, rpcResult)
      default:
        return { success: rpcResult.success, message: rpcResult.output || rpcResult.error }
    }
  },

  _parseScQuery(rpcResult) {
    const output = rpcResult.output || ''
    const error = rpcResult.error || ''

    // 서비스 미설치 감지: sc query → error 1060
    if (!rpcResult.success && /1060|does not exist|지정된 서비스가/i.test(output + ' ' + error)) {
      return { running: false, state: 'NOT_INSTALLED', raw: output }
    }

    const STATE_NAMES = 'STOPPED|START_PENDING|STOP_PENDING|RUNNING|CONTINUE_PENDING|PAUSE_PENDING|PAUSED'
    const stateMatch = output.match(new RegExp(`:\\s+([1-7])\\s+(${STATE_NAMES})`))

    const stateStr = stateMatch ? stateMatch[2] : 'UNKNOWN'
    const running = stateStr === 'RUNNING'

    return { running, state: stateStr, raw: output }
  },

  _parseNetResult(action, rpcResult) {
    const output = (rpcResult.output || '') + ' ' + (rpcResult.error || '')
    const lower = output.toLowerCase()

    // 멱등성 처리: "이미 시작됨/중지됨"은 성공으로 간주
    if (action === 'start' && (lower.includes('already been started') || lower.includes('이미 시작'))) {
      return { success: true, message: 'Service is already running' }
    }
    if (action === 'stop' && (lower.includes('has not been started') || lower.includes('시작되지 않았'))) {
      return { success: true, message: 'Service is already stopped' }
    }

    // exit code 0 → 성공
    if (rpcResult.success) {
      const messages = { start: 'Service started successfully', stop: 'Service stopped successfully' }
      return { success: true, message: messages[action] || `${action} completed` }
    }

    // 에러 분류 (EN/KR 패턴 매칭)
    if (lower.includes('service name is invalid') || lower.includes('서비스 이름이 잘못')) {
      return { success: false, message: 'Service not found (invalid service name)' }
    }
    if (lower.includes('access is denied') || lower.includes('액세스가 거부')) {
      return { success: false, message: 'Access denied - insufficient permissions' }
    }
    if (lower.includes('could not be controlled') || lower.includes('제어할 수 없')) {
      return { success: false, message: 'Service is in a pending state and cannot be controlled' }
    }

    return { success: false, message: rpcResult.error || rpcResult.output || `${action} failed` }
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
  getTailCommand(filePath, lines, basePath, offset) {
    const tailBin = basePath ? `${basePath}/utils/tail` : 'tail'
    if (offset != null) {  // != null: 0 is a valid offset
      return { commandLine: tailBin, args: ['--from-offset', String(offset), '--report-offset', filePath], timeout: 10000 }
    }
    return { commandLine: tailBin, args: ['-n', String(lines), '--report-offset', filePath], timeout: 10000 }
  },

  // --- List Files (configTestController.js) ---
  getListFilesCommand(directory) {
    // Windows cmd /c dir requires backslash separators ('/' is parsed as option flag)
    const winPath = (directory || '').replace(/\//g, '\\')
    return {
      commandLine: 'cmd',
      args: ['/c', 'dir', '/A-D', '/B', winPath],
      timeout: 15000
    }
  },

  parseListFilesResponse(rpcResult) {
    if (!rpcResult.success) {
      const combined = (rpcResult.output || '') + ' ' + (rpcResult.error || '')
      if (/file not found|cannot find|does not exist|찾을 수 없/i.test(combined))
        return { files: [], error: '디렉토리를 찾을 수 없습니다' }
      // dir /A-D /B: exit code 1 = 파일 없음 또는 디렉토리 없음
      // ManagerAgent가 실제 stderr 대신 exit code만 전달하는 경우 대비
      return { files: [], error: rpcResult.error || '파일 목록 조회 실패' }
    }
    const output = (rpcResult.output || '').trim()
    if (!output) return { files: [] }
    return {
      files: output.split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0)
        .map(name => ({ name, size: 0, modifiedAt: null }))
    }
  }

}
