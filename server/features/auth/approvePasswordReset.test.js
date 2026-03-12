/**
 * approvePasswordReset email integration — tests (TDD)
 *
 * Uses _setDeps() dependency injection for User model and email services.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { approvePasswordReset, _setDeps } from './service.js'

// --- Mock dependencies ---
const mockFindById = vi.fn()
const mockResolveEmail = vi.fn()
const mockSendEmailTo = vi.fn()
const mockBuildTempPasswordEmail = vi.fn()

_setDeps({
  User: { findById: mockFindById },
  resolveEmail: mockResolveEmail,
  sendEmailTo: mockSendEmailTo,
  buildTempPasswordEmail: mockBuildTempPasswordEmail
})

beforeEach(() => {
  vi.clearAllMocks()
  mockBuildTempPasswordEmail.mockReturnValue('<html>email body</html>')
  mockSendEmailTo.mockResolvedValue({ sent: true, subscribers: 1 })
})

function mockUser(overrides = {}) {
  const user = {
    _id: 'user123',
    singleid: 'testuser',
    password: null,
    passwordStatus: 'reset_requested',
    passwordResetRequestedAt: new Date(),
    save: vi.fn().mockResolvedValue(true),
    ...overrides
  }
  mockFindById.mockResolvedValue(user)
  return user
}

describe('approvePasswordReset — email integration', () => {
  it('사용자 존재 + email 있음 → sendEmailTo 호출됨, emailSent: true', async () => {
    mockUser()
    mockResolveEmail.mockResolvedValue('user@test.com')

    const result = await approvePasswordReset('user123')

    expect(result.success).toBe(true)
    expect(result.emailSent).toBe(true)
    expect(mockResolveEmail).toHaveBeenCalledWith('testuser')
    expect(mockBuildTempPasswordEmail).toHaveBeenCalledWith('testuser', expect.any(String))
    expect(mockSendEmailTo).toHaveBeenCalledWith(
      'user@test.com',
      '[WebManager] 비밀번호 초기화 안내',
      '<html>email body</html>'
    )
  })

  it('사용자 존재 + email 없음 → sendEmailTo 미호출, emailSent: false', async () => {
    mockUser()
    mockResolveEmail.mockResolvedValue(null)

    const result = await approvePasswordReset('user123')

    expect(result.success).toBe(true)
    expect(result.emailSent).toBe(false)
    expect(mockSendEmailTo).not.toHaveBeenCalled()
  })

  it('이메일 발송 실패 → 비밀번호 초기화는 성공, emailSent: false', async () => {
    mockUser()
    mockResolveEmail.mockResolvedValue('user@test.com')
    mockSendEmailTo.mockResolvedValue({ sent: false, error: 'Redis not available' })

    const result = await approvePasswordReset('user123')

    expect(result.success).toBe(true)
    expect(result.tempPassword).toBeTruthy()
    expect(result.emailSent).toBe(false)
  })

  it('사용자 미존재 → error 반환, 이메일 미시도', async () => {
    mockFindById.mockResolvedValue(null)

    const result = await approvePasswordReset('nonexistent')

    expect(result.error).toBe('User not found')
    expect(mockResolveEmail).not.toHaveBeenCalled()
    expect(mockSendEmailTo).not.toHaveBeenCalled()
  })

  it('기존 동작 유지 — tempPassword, singleid 반환', async () => {
    mockUser()
    mockResolveEmail.mockResolvedValue(null)

    const result = await approvePasswordReset('user123')

    expect(result.singleid).toBe('testuser')
    expect(result.tempPassword).toHaveLength(8)
    expect(result.message).toBeTruthy()
  })
})
