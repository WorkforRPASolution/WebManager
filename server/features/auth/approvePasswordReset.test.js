/**
 * approvePasswordReset email integration — tests (TDD)
 *
 * Uses _setDeps() dependency injection for User model and email services.
 * DB email 필드 삭제됨 — resolveEmail fallback 제거, manualEmail만 사용
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { approvePasswordReset, _setDeps } from './service.js'

// --- Mock dependencies ---
const mockFindById = vi.fn()
const mockSendEmailTo = vi.fn()
const mockBuildTempPasswordEmail = vi.fn()

_setDeps({
  User: { findById: mockFindById },
  sendEmailTo: mockSendEmailTo,
  buildTempPasswordEmail: mockBuildTempPasswordEmail
})

let originalMode

beforeEach(() => {
  vi.clearAllMocks()
  originalMode = process.env.OPERATION_MODE
  mockBuildTempPasswordEmail.mockReturnValue('<html>email body</html>')
  mockSendEmailTo.mockResolvedValue({ sent: true, subscribers: 1 })
})

afterEach(() => {
  if (originalMode === undefined) {
    delete process.env.OPERATION_MODE
  } else {
    process.env.OPERATION_MODE = originalMode
  }
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

describe('approvePasswordReset — integrated mode', () => {
  beforeEach(() => {
    process.env.OPERATION_MODE = 'integrated'
  })

  it('수동 email 전달 시 → 해당 email로 발송, emailSent: true', async () => {
    mockUser()

    const result = await approvePasswordReset('user123', { email: 'manual@test.com' })

    expect(result.success).toBe(true)
    expect(result.emailSent).toBe(true)
    expect(mockBuildTempPasswordEmail).toHaveBeenCalledWith('testuser', expect.any(String))
    expect(mockSendEmailTo).toHaveBeenCalledWith(
      'manual@test.com',
      '[WebManager] 비밀번호 초기화 안내',
      '<html>email body</html>'
    )
  })

  it('email 미전달 → sendEmailTo 미호출, emailSent: false', async () => {
    mockUser()

    const result = await approvePasswordReset('user123')

    expect(result.success).toBe(true)
    expect(result.emailSent).toBe(false)
    expect(mockSendEmailTo).not.toHaveBeenCalled()
  })

  it('빈 문자열 email → sendEmailTo 미호출, emailSent: false', async () => {
    mockUser()

    const result = await approvePasswordReset('user123', { email: '' })

    expect(result.success).toBe(true)
    expect(result.emailSent).toBe(false)
    expect(mockSendEmailTo).not.toHaveBeenCalled()
  })

  it('이메일 발송 실패 → 비밀번호 초기화는 성공, emailSent: false', async () => {
    mockUser()
    mockSendEmailTo.mockResolvedValue({ sent: false, error: 'Redis not available' })

    const result = await approvePasswordReset('user123', { email: 'user@test.com' })

    expect(result.success).toBe(true)
    expect(result.tempPassword).toBeTruthy()
    expect(result.emailSent).toBe(false)
  })

  it('사용자 미존재 → error 반환, 이메일 미시도', async () => {
    mockFindById.mockResolvedValue(null)

    const result = await approvePasswordReset('nonexistent')

    expect(result.error).toBe('User not found')
    expect(mockSendEmailTo).not.toHaveBeenCalled()
  })

  it('기존 동작 유지 — tempPassword, singleid 반환', async () => {
    mockUser()

    const result = await approvePasswordReset('user123', { email: 'user@test.com' })

    expect(result.singleid).toBe('testuser')
    expect(result.tempPassword).toHaveLength(8)
    expect(result.message).toBeTruthy()
  })
})

describe('approvePasswordReset — standalone mode', () => {
  beforeEach(() => {
    delete process.env.OPERATION_MODE
  })

  it('standalone → 이메일 서비스 미호출, emailSent: false 고정', async () => {
    mockUser()

    const result = await approvePasswordReset('user123')

    expect(result.success).toBe(true)
    expect(result.tempPassword).toHaveLength(8)
    expect(result.emailSent).toBe(false)
    expect(mockSendEmailTo).not.toHaveBeenCalled()
  })

  it('standalone + 수동 email → 이메일 서비스 미호출', async () => {
    mockUser()

    const result = await approvePasswordReset('user123', { email: 'manual@test.com' })

    expect(result.success).toBe(true)
    expect(result.emailSent).toBe(false)
    expect(mockSendEmailTo).not.toHaveBeenCalled()
  })
})
