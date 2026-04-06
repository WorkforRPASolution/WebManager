import { describe, it, expect, vi, afterEach } from 'vitest'
import os from 'os'

describe('podIdentity', () => {
  afterEach(() => {
    delete process.env.POD_NAME
    // Re-import to reset cached module state
    vi.resetModules()
  })

  it('POD_NAME 미설정 시 os.hostname() 반환', async () => {
    delete process.env.POD_NAME
    const { getPodId } = await import('./podIdentity.js')
    expect(getPodId()).toBe(os.hostname())
  })

  it('POD_NAME 설정 시 우선 사용', async () => {
    process.env.POD_NAME = 'webmanager-abc123'
    const { getPodId } = await import('./podIdentity.js')
    expect(getPodId()).toBe('webmanager-abc123')
  })
})
