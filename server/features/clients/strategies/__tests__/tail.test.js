import { describe, it, expect } from 'vitest'

import arsWinSc from '../arsAgentWinSc'
import resWinSc from '../resourceAgentWinSc'
import arsLinux from '../arsAgentLinuxSystemd'
import resLinux from '../resourceAgentLinuxSystemd'

describe('getTailCommand — basePath + utils/tail', () => {
  it('win_sc: basePath가 있으면 절대경로 utils/tail', () => {
    const cmd = arsWinSc.getTailCommand('/logs/ars.log', 50, '/app/ManagerAgent')
    expect(cmd.commandLine).toBe('/app/ManagerAgent/utils/tail')
    expect(cmd.args).toEqual(['-n', '50', '--report-offset', '/logs/ars.log'])
    expect(cmd.timeout).toBe(10000)
  })

  it('win_sc: basePath가 없으면 fallback tail', () => {
    const cmd = arsWinSc.getTailCommand('/logs/ars.log', 50, null)
    expect(cmd.commandLine).toBe('tail')
    expect(cmd.args).toEqual(['-n', '50', '--report-offset', '/logs/ars.log'])
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
    expect(resCmd.args).toContain('--report-offset')
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

describe('getTailCommand — offset mode (--from-offset / --report-offset)', () => {
  it('win_sc: offset=null → -n + --report-offset', () => {
    const cmd = arsWinSc.getTailCommand('/logs/ars.log', 50, '/app/ManagerAgent', null)
    expect(cmd.commandLine).toBe('/app/ManagerAgent/utils/tail')
    expect(cmd.args).toContain('-n')
    expect(cmd.args).toContain('--report-offset')
    expect(cmd.args).not.toContain('--from-offset')
    expect(cmd.args).toEqual(['-n', '50', '--report-offset', '/logs/ars.log'])
  })

  it('win_sc: offset=12345 → --from-offset 12345 + --report-offset', () => {
    const cmd = arsWinSc.getTailCommand('/logs/ars.log', 50, '/app/ManagerAgent', 12345)
    expect(cmd.commandLine).toBe('/app/ManagerAgent/utils/tail')
    expect(cmd.args).toContain('--from-offset')
    expect(cmd.args).toContain('12345')
    expect(cmd.args).toContain('--report-offset')
    expect(cmd.args).not.toContain('-n')
    expect(cmd.args).toEqual(['--from-offset', '12345', '--report-offset', '/logs/ars.log'])
  })

  it('win_sc: offset=0 은 유효한 값 (falsy가 아님)', () => {
    const cmd = arsWinSc.getTailCommand('/logs/ars.log', 50, '/app/ManagerAgent', 0)
    expect(cmd.args).toContain('--from-offset')
    expect(cmd.args).toContain('0')
    expect(cmd.args).not.toContain('-n')
    expect(cmd.args).toEqual(['--from-offset', '0', '--report-offset', '/logs/ars.log'])
  })

  it('linux_systemd: offset 무시, 항상 -n 사용', () => {
    const cmd = arsLinux.getTailCommand('/logs/ars.log', 50, '/base', 12345)
    expect(cmd.commandLine).toBe('tail')
    expect(cmd.args).toEqual(['-n', '50', '/logs/ars.log'])
    expect(cmd.args).not.toContain('--from-offset')
    expect(cmd.args).not.toContain('--report-offset')
  })

  it('resourceAgentWinSc도 arsAgentWinSc와 동일한 offset 동작', () => {
    const arsNull = arsWinSc.getTailCommand('/log.txt', 50, '/base', null)
    const resNull = resWinSc.getTailCommand('/log.txt', 50, '/base', null)
    expect(resNull.args).toEqual(arsNull.args)

    const arsOffset = arsWinSc.getTailCommand('/log.txt', 50, '/base', 12345)
    const resOffset = resWinSc.getTailCommand('/log.txt', 50, '/base', 12345)
    expect(resOffset.args).toEqual(arsOffset.args)

    const arsZero = arsWinSc.getTailCommand('/log.txt', 50, '/base', 0)
    const resZero = resWinSc.getTailCommand('/log.txt', 50, '/base', 0)
    expect(resZero.args).toEqual(arsZero.args)
  })
})
