import { describe, it, expect } from 'vitest'

import arsAgentWinSc from '../arsAgentWinSc'
import arsAgentLinuxSystemd from '../arsAgentLinuxSystemd'
import resourceAgentWinSc from '../resourceAgentWinSc'
import resourceAgentLinuxSystemd from '../resourceAgentLinuxSystemd'

// ----- Windows SC: _parseScQuery -----

describe.each([
  ['arsAgentWinSc', arsAgentWinSc],
  ['resourceAgentWinSc', resourceAgentWinSc],
])('%s _parseScQuery', (_name, strategy) => {

  it('should detect RUNNING state', () => {
    const rpcResult = {
      success: true,
      output: 'SERVICE_NAME: ARSAgent\r\n        TYPE               : 10  WIN32_OWN_PROCESS\r\n        STATE              :  4  RUNNING\r\n',
      error: ''
    }
    const result = strategy._parseScQuery(rpcResult)
    expect(result.running).toBe(true)
    expect(result.state).toBe('RUNNING')
  })

  it('should detect STOPPED state', () => {
    const rpcResult = {
      success: true,
      output: 'SERVICE_NAME: ARSAgent\r\n        STATE              :  1  STOPPED\r\n',
      error: ''
    }
    const result = strategy._parseScQuery(rpcResult)
    expect(result.running).toBe(false)
    expect(result.state).toBe('STOPPED')
  })

  it('should detect NOT_INSTALLED when error 1060', () => {
    const rpcResult = {
      success: false,
      output: '[SC] OpenService FAILED 1060:\r\n\r\nThe specified service does not exist as an installed service.\r\n',
      error: ''
    }
    const result = strategy._parseScQuery(rpcResult)
    expect(result.running).toBe(false)
    expect(result.state).toBe('NOT_INSTALLED')
  })

  it('should detect NOT_INSTALLED when Korean error 1060', () => {
    const rpcResult = {
      success: false,
      output: '[SC] OpenService 실패 1060:\r\n\r\n지정된 서비스가 설치된 서비스로 존재하지 않습니다.\r\n',
      error: ''
    }
    const result = strategy._parseScQuery(rpcResult)
    expect(result.running).toBe(false)
    expect(result.state).toBe('NOT_INSTALLED')
  })

  it('should detect NOT_INSTALLED when "does not exist" in error field', () => {
    const rpcResult = {
      success: false,
      output: '',
      error: 'The specified service does not exist as an installed service.'
    }
    const result = strategy._parseScQuery(rpcResult)
    expect(result.running).toBe(false)
    expect(result.state).toBe('NOT_INSTALLED')
  })

  it('should return UNKNOWN for other failures (not 1060)', () => {
    const rpcResult = {
      success: false,
      output: '[SC] OpenService FAILED 5:\r\nAccess is denied.\r\n',
      error: ''
    }
    const result = strategy._parseScQuery(rpcResult)
    expect(result.state).toBe('UNKNOWN')
  })
})


// ----- Linux Systemd: _parseSystemctlStatus -----

describe.each([
  ['arsAgentLinuxSystemd', arsAgentLinuxSystemd],
  ['resourceAgentLinuxSystemd', resourceAgentLinuxSystemd],
])('%s _parseSystemctlStatus', (_name, strategy) => {

  it('should detect RUNNING state', () => {
    const rpcResult = {
      success: true,
      output: 'ARSAgent.service - ARS Agent Service\n   Active: active (running) since Mon 2026-01-01 00:00:00 UTC\n Main PID: 1234 (java)',
      error: ''
    }
    const result = strategy._parseSystemctlStatus(rpcResult)
    expect(result.running).toBe(true)
    expect(result.state).toBe('RUNNING')
    expect(result.pid).toBe(1234)
  })

  it('should detect STOPPED state', () => {
    const rpcResult = {
      success: true,
      output: 'ARSAgent.service - ARS Agent Service\n   Active: inactive (dead) since Mon 2026-01-01 00:00:00 UTC',
      error: ''
    }
    const result = strategy._parseSystemctlStatus(rpcResult)
    expect(result.running).toBe(false)
    expect(result.state).toBe('STOPPED')
  })

  it('should detect NOT_INSTALLED when "could not be found"', () => {
    const rpcResult = {
      success: false,
      output: '',
      error: 'Unit ARSAgent.service could not be found.'
    }
    const result = strategy._parseSystemctlStatus(rpcResult)
    expect(result.running).toBe(false)
    expect(result.state).toBe('NOT_INSTALLED')
    expect(result.pid).toBe(0)
  })

  it('should detect NOT_INSTALLED when "not found" in output', () => {
    const rpcResult = {
      success: false,
      output: 'Unit ARSAgent.service not found.',
      error: ''
    }
    const result = strategy._parseSystemctlStatus(rpcResult)
    expect(result.running).toBe(false)
    expect(result.state).toBe('NOT_INSTALLED')
  })

  it('should return UNKNOWN for other failures', () => {
    const rpcResult = {
      success: false,
      output: 'Failed to get properties: Access denied',
      error: ''
    }
    const result = strategy._parseSystemctlStatus(rpcResult)
    expect(result.state).toBe('UNKNOWN')
  })
})
