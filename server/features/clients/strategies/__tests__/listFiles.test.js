import { describe, it, expect } from 'vitest'
import arsWinSc from '../arsAgentWinSc'
import resWinSc from '../resourceAgentWinSc'
import arsLinux from '../arsAgentLinuxSystemd'
import resLinux from '../resourceAgentLinuxSystemd'

describe('arsAgentWinSc.parseListFilesResponse', () => {
  it('파일 여러 개 — 줄 단위 파싱', () => {
    const rpcResult = {
      success: true,
      output: 'test.log\napp.log\ndata.txt\n',
      error: ''
    }
    const result = arsWinSc.parseListFilesResponse(rpcResult)
    expect(result.files).toHaveLength(3)
    expect(result.files[0]).toEqual({ name: 'test.log', size: 0, modifiedAt: null })
    expect(result.files[1]).toEqual({ name: 'app.log', size: 0, modifiedAt: null })
    expect(result.files[2]).toEqual({ name: 'data.txt', size: 0, modifiedAt: null })
  })

  it('파일 1개', () => {
    const rpcResult = {
      success: true,
      output: 'only.log\n',
      error: ''
    }
    const result = arsWinSc.parseListFilesResponse(rpcResult)
    expect(result.files).toHaveLength(1)
    expect(result.files[0].name).toBe('only.log')
    expect(result.files[0].size).toBe(0)
    expect(result.files[0].modifiedAt).toBeNull()
  })

  it('빈 디렉토리 — output 빈 문자열', () => {
    const rpcResult = { success: true, output: '', error: '' }
    const result = arsWinSc.parseListFilesResponse(rpcResult)
    expect(result.files).toEqual([])
  })

  it('디렉토리 미존재 — error에 "File Not Found"', () => {
    const rpcResult = { success: false, output: '', error: 'File Not Found' }
    const result = arsWinSc.parseListFilesResponse(rpcResult)
    expect(result.files).toEqual([])
    expect(result.error).toMatch(/찾을 수 없습니다/)
  })

  it('디렉토리 미존재 — output에 에러 메시지 (ManagerAgent 패턴)', () => {
    const rpcResult = { success: false, output: 'File Not Found', error: 'Process exited with an error: 1 (Exit value: 1)' }
    const result = arsWinSc.parseListFilesResponse(rpcResult)
    expect(result.files).toEqual([])
    expect(result.error).toMatch(/찾을 수 없습니다/)
  })

  it('기타 에러 — throw', () => {
    const rpcResult = { success: false, output: '', error: 'Access denied' }
    expect(() => arsWinSc.parseListFilesResponse(rpcResult)).toThrow('Access denied')
  })
})

describe('arsAgentWinSc.getListFilesCommand', () => {
  it('cmd dir 커맨드 반환', () => {
    const cmd = arsWinSc.getListFilesCommand('D:\\Testlog')
    expect(cmd.commandLine).toBe('cmd')
    expect(cmd.args[0]).toBe('/c')
    expect(cmd.args).toContain('dir')
    expect(cmd.args).toContain('/A-D')
    expect(cmd.args).toContain('/B')
    expect(cmd.args).toContain('D:\\Testlog')
    expect(cmd.timeout).toBeGreaterThan(0)
  })
})

describe('resourceAgentWinSc — same interface as arsAgentWinSc', () => {
  it('parseListFilesResponse works', () => {
    const rpcResult = {
      success: true,
      output: 'res.log\ndata.csv\n',
      error: ''
    }
    const result = resWinSc.parseListFilesResponse(rpcResult)
    expect(result.files).toHaveLength(2)
    expect(result.files[0].name).toBe('res.log')
    expect(result.files[0].size).toBe(0)
  })

  it('getListFilesCommand works', () => {
    const cmd = resWinSc.getListFilesCommand('C:\\Logs')
    expect(cmd.commandLine).toBe('cmd')
    expect(cmd.args).toContain('dir')
    expect(cmd.args).toContain('/A-D')
    expect(cmd.args).toContain('/B')
    expect(cmd.args).toContain('C:\\Logs')
  })
})

describe('arsAgentLinuxSystemd.parseListFilesResponse', () => {
  it('find -printf TSV 파싱', () => {
    const rpcResult = {
      success: true,
      output: 'test.log\t1024\t1739952600.000\napp.log\t2048\t1739949000.000\n',
      error: ''
    }
    const result = arsLinux.parseListFilesResponse(rpcResult)
    expect(result.files).toHaveLength(2)
    expect(result.files[0].name).toBe('test.log')
    expect(result.files[0].size).toBe(1024)
    expect(result.files[0].modifiedAt).toBeTruthy()
  })

  it('빈 디렉토리', () => {
    const rpcResult = { success: true, output: '', error: '' }
    const result = arsLinux.parseListFilesResponse(rpcResult)
    expect(result.files).toEqual([])
  })

  it('디렉토리 미존재', () => {
    const rpcResult = { success: false, output: '', error: 'find: /no/such: No such file or directory' }
    const result = arsLinux.parseListFilesResponse(rpcResult)
    expect(result.files).toEqual([])
    expect(result.error).toBeTruthy()
  })

  it('디렉토리 미존재 — output에 에러 메시지 (ManagerAgent 패턴)', () => {
    const rpcResult = { success: false, output: 'find: /no/such: No such file or directory', error: 'Process exited with an error: 1 (Exit value: 1)' }
    const result = arsLinux.parseListFilesResponse(rpcResult)
    expect(result.files).toEqual([])
    expect(result.error).toBeTruthy()
  })

  it('기타 에러 — throw', () => {
    const rpcResult = { success: false, output: '', error: 'Permission denied' }
    expect(() => arsLinux.parseListFilesResponse(rpcResult)).toThrow('Permission denied')
  })
})

describe('arsAgentLinuxSystemd.getListFilesCommand', () => {
  it('find 커맨드 반환', () => {
    const cmd = arsLinux.getListFilesCommand('/var/log/ars')
    expect(cmd.commandLine).toBe('find')
    expect(cmd.args).toContain('/var/log/ars')
    expect(cmd.args).toContain('-maxdepth')
    expect(cmd.args).toContain('1')
    expect(cmd.timeout).toBeGreaterThan(0)
  })
})

describe('resourceAgentLinuxSystemd — same interface as arsAgentLinuxSystemd', () => {
  it('parseListFilesResponse works', () => {
    const rpcResult = {
      success: true,
      output: 'res.log\t512\t1739950000.000\n',
      error: ''
    }
    const result = resLinux.parseListFilesResponse(rpcResult)
    expect(result.files).toHaveLength(1)
    expect(result.files[0].name).toBe('res.log')
  })

  it('getListFilesCommand works', () => {
    const cmd = resLinux.getListFilesCommand('/opt/logs')
    expect(cmd.commandLine).toBe('find')
    expect(cmd.args).toContain('/opt/logs')
  })
})
