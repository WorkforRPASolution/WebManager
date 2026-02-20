import { describe, it, expect } from 'vitest'

import arsWinSc from '../arsAgentWinSc'
import resWinSc from '../resourceAgentWinSc'
import arsLinux from '../arsAgentLinuxSystemd'
import resLinux from '../resourceAgentLinuxSystemd'

describe('getTailCommand — basePath + utils/tail', () => {
  it('win_sc: basePath가 있으면 절대경로 utils/tail', () => {
    const cmd = arsWinSc.getTailCommand('/logs/ars.log', 50, '/app/ManagerAgent')
    expect(cmd.commandLine).toBe('/app/ManagerAgent/utils/tail')
    expect(cmd.args).toEqual(['-n', '50', '/logs/ars.log'])
    expect(cmd.timeout).toBe(10000)
  })

  it('win_sc: basePath가 없으면 fallback tail', () => {
    const cmd = arsWinSc.getTailCommand('/logs/ars.log', 50, null)
    expect(cmd.commandLine).toBe('tail')
    expect(cmd.args).toEqual(['-n', '50', '/logs/ars.log'])
  })

  it('win_sc: basePath undefined도 fallback', () => {
    const cmd = arsWinSc.getTailCommand('/logs/ars.log', 50)
    expect(cmd.commandLine).toBe('tail')
  })

  it('resourceAgentWinSc도 동일 동작', () => {
    const arsCmd = arsWinSc.getTailCommand('/log.txt', 50, '/base')
    const resCmd = resWinSc.getTailCommand('/log.txt', 50, '/base')
    expect(resCmd.commandLine).toBe(arsCmd.commandLine)
    expect(resCmd.args).toEqual(arsCmd.args)
  })

  it('linux_systemd: basePath 무시, 시스템 tail 사용', () => {
    const cmd = arsLinux.getTailCommand('/logs/ars.log', 50, '/base')
    expect(cmd.commandLine).toBe('tail')
    expect(cmd.args).toEqual(['-n', '50', '/logs/ars.log'])
  })

  it('resourceAgentLinuxSystemd도 동일', () => {
    const cmd = resLinux.getTailCommand('/logs/res.log', 100, '/base')
    expect(cmd.commandLine).toBe('tail')
    expect(cmd.args).toEqual(['-n', '100', '/logs/res.log'])
  })
})
