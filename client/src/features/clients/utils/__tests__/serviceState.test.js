import { describe, it, expect } from 'vitest'
import { classifyServiceState } from '../serviceState.js'

describe('classifyServiceState', () => {
  it('returns "unknown" for null/undefined input', () => {
    expect(classifyServiceState(null)).toBe('unknown')
    expect(classifyServiceState(undefined)).toBe('unknown')
  })

  it('returns "loading" when loading is true', () => {
    expect(classifyServiceState({ loading: true })).toBe('loading')
  })

  it('returns "unknown" when error exists', () => {
    expect(classifyServiceState({ error: 'some error' })).toBe('unknown')
  })

  it('returns "unreachable" for UNREACHABLE state', () => {
    expect(classifyServiceState({ state: 'UNREACHABLE' })).toBe('unreachable')
  })

  it('returns "not_installed" for NOT_INSTALLED state', () => {
    expect(classifyServiceState({ state: 'NOT_INSTALLED' })).toBe('not_installed')
  })

  it('returns "running" when running is true', () => {
    expect(classifyServiceState({ running: true })).toBe('running')
    expect(classifyServiceState({ running: true, state: 'RUNNING' })).toBe('running')
  })

  it('returns "stopped" when running is false', () => {
    expect(classifyServiceState({ running: false })).toBe('stopped')
    expect(classifyServiceState({ running: false, state: 'STOPPED' })).toBe('stopped')
  })

  it('returns "unknown" for ambiguous data', () => {
    expect(classifyServiceState({})).toBe('unknown')
    expect(classifyServiceState({ state: 'SOME_OTHER' })).toBe('unknown')
  })
})
