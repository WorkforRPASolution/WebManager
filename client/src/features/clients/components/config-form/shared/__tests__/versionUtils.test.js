import { describe, it, expect } from 'vitest'
import { compareVersions, isNewLogTypeVersion } from '../versionUtils'

describe('compareVersions', () => {
  it('equal versions return 0', () => {
    expect(compareVersions('6.8.5.24', '6.8.5.24')).toBe(0)
  })

  it('a < b returns -1', () => {
    expect(compareVersions('6.8.5.24', '7.0.0.0')).toBe(-1)
    expect(compareVersions('6.9.9.9', '7.0.0.0')).toBe(-1)
    expect(compareVersions('7.0.0.0', '7.0.0.1')).toBe(-1)
  })

  it('a > b returns 1', () => {
    expect(compareVersions('7.0.0.0', '6.8.5.24')).toBe(1)
    expect(compareVersions('7.1.0.0', '7.0.0.0')).toBe(1)
  })

  it('handles different segment lengths', () => {
    expect(compareVersions('7.0', '7.0.0.0')).toBe(0)
    expect(compareVersions('7', '6.9.9.9')).toBe(1)
  })

  it('handles null/undefined/empty', () => {
    expect(compareVersions(null, '7.0.0.0')).toBe(-1)
    expect(compareVersions('7.0.0.0', null)).toBe(1)
    expect(compareVersions(null, null)).toBe(0)
    expect(compareVersions('', '')).toBe(0)
  })
})

describe('isNewLogTypeVersion', () => {
  it('returns false for null/undefined', () => {
    expect(isNewLogTypeVersion(null)).toBe(false)
    expect(isNewLogTypeVersion(undefined)).toBe(false)
    expect(isNewLogTypeVersion('')).toBe(false)
  })

  it('returns false for old versions', () => {
    expect(isNewLogTypeVersion('6.8.5.24')).toBe(false)
    expect(isNewLogTypeVersion('6.9.9.9')).toBe(false)
  })

  it('returns true for threshold version', () => {
    expect(isNewLogTypeVersion('7.0.0.0')).toBe(true)
  })

  it('returns true for newer versions', () => {
    expect(isNewLogTypeVersion('7.0.0.1')).toBe(true)
    expect(isNewLogTypeVersion('8.0.0.0')).toBe(true)
  })
})
