import { describe, it, expect } from 'vitest'
import { filterByPattern, isAbsolutePath } from './configTestController'

describe('filterByPattern', () => {
  const files = [
    { name: 'TestLog_20260219.log', size: 100 },
    { name: 'TestLog_20260218.log.bak', size: 200 },
    { name: 'AppLog_20260219.log', size: 300 },
    { name: 'TestLog_20260219.txt', size: 400 },
  ]

  it('prefix 필터', () => {
    const result = filterByPattern(files, { prefix: 'TestLog', suffix: '', exclude_suffix: [] })
    expect(result).toHaveLength(3)
  })

  it('suffix 필터', () => {
    const result = filterByPattern(files, { prefix: '', suffix: '.log', exclude_suffix: [] })
    expect(result).toHaveLength(2)
  })

  it('exclude_suffix 필터', () => {
    const result = filterByPattern(files, { prefix: 'TestLog', suffix: '', exclude_suffix: ['.bak'] })
    expect(result).toHaveLength(2)
  })

  it('prefix + suffix 복합', () => {
    const result = filterByPattern(files, { prefix: 'TestLog', suffix: '.log', exclude_suffix: ['.bak'] })
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('TestLog_20260219.log')
  })

  it('빈 조건 — 전체 반환', () => {
    const result = filterByPattern(files, { prefix: '', suffix: '', exclude_suffix: [] })
    expect(result).toHaveLength(4)
  })
})

describe('isAbsolutePath', () => {
  it('Windows 절대경로', () => {
    expect(isAbsolutePath('D:\\Testlog')).toBe(true)
    expect(isAbsolutePath('C:/Users/test')).toBe(true)
  })
  it('Linux 절대경로', () => {
    expect(isAbsolutePath('/var/log/ars')).toBe(true)
  })
  it('상대경로', () => {
    expect(isAbsolutePath('logs/access')).toBe(false)
    expect(isAbsolutePath('TestLog')).toBe(false)
  })
})
