/**
 * requestPasswordReset — mode-based tests (TDD)
 *
 * Uses _setDeps() dependency injection for User model and email services.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { requestPasswordReset, _setDeps } from './service.js'

// --- Mock dependencies ---
const mockFindOne = vi.fn()
const mockSendEmailTo = vi.fn()
const mockBuildTempPasswordEmail = vi.fn()

_setDeps({
  User: { findOne: mockFindOne, findById: vi.fn() },
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
    password: '$2a$12$existinghash',
    passwordStatus: 'normal',
    passwordResetRequestedAt: null,
    save: vi.fn().mockResolvedValue(true),
    ...overrides
  }
  mockFindOne.mockResolvedValue(user)
  return user
}

describe('requestPasswordReset — standalone mode', () => {
  beforeEach(() => {
    delete process.env.OPERATION_MODE
  })

  it('singleid만 전달 → passwordStatus = reset_requested (기존 동작)', async () => {
    const user = mockUser()

    const result = await requestPasswordReset('testuser')

    expect(result.success).toBe(true)
    expect(user.passwordStatus).toBe('reset_requested')
    expect(user.passwordResetRequestedAt).toBeInstanceOf(Date)
    expect(user.save).toHaveBeenCalled()
  })

  it('email 전달해도 무시 (standalone에서는 이메일 발송 없음)', async () => {
    const user = mockUser()

    const result = await requestPasswordReset('testuser', { email: 'user@test.com' })

    expect(result.success).toBe(true)
    expect(user.passwordStatus).toBe('reset_requested')
    expect(mockSendEmailTo).not.toHaveBeenCalled()
  })

  it('사용자 미존재 → 동일한 성공 메시지 (보안)', async () => {
    mockFindOne.mockResolvedValue(null)

    const result = await requestPasswordReset('nonexistent')

    expect(result.success).toBe(true)
    expect(result.message).toBeTruthy()
  })
})

describe('requestPasswordReset — integrated mode', () => {
  beforeEach(() => {
    process.env.OPERATION_MODE = 'integrated'
  })

  it('singleid + email → 임시 비밀번호 생성 + 이메일 발송 + passwordStatus = must_change', async () => {
    const user = mockUser()

    const result = await requestPasswordReset('testuser', { email: 'user@test.com' })

    expect(result.success).toBe(true)
    expect(user.passwordStatus).toBe('must_change')
    expect(user.password).toBeTruthy()
    expect(user.password).not.toBe('$2a$12$existinghash') // 새 해시
    expect(user.save).toHaveBeenCalled()
    expect(mockBuildTempPasswordEmail).toHaveBeenCalledWith('testuser', expect.any(String))
    expect(mockSendEmailTo).toHaveBeenCalledWith(
      'user@test.com',
      '[WebManager] 비밀번호 초기화 안내',
      '<html>email body</html>'
    )
    // 응답에 tempPassword 미포함 (보안)
    expect(result.tempPassword).toBeUndefined()
  })

  it('email 미입력 → 에러', async () => {
    mockUser()

    const result = await requestPasswordReset('testuser')

    expect(result.error).toBeTruthy()
    expect(result.success).toBeUndefined()
  })

  it('email 빈 문자열 → 에러', async () => {
    mockUser()

    const result = await requestPasswordReset('testuser', { email: '' })

    expect(result.error).toBeTruthy()
  })

  it('사용자 미존재 → 동일한 성공 메시지 (보안)', async () => {
    mockFindOne.mockResolvedValue(null)

    const result = await requestPasswordReset('testuser', { email: 'user@test.com' })

    expect(result.success).toBe(true)
    expect(mockSendEmailTo).not.toHaveBeenCalled()
  })

  it('이메일 발송 실패 → 비밀번호 초기화는 성공', async () => {
    const user = mockUser()
    mockSendEmailTo.mockResolvedValue({ sent: false, error: 'Redis not available' })

    const result = await requestPasswordReset('testuser', { email: 'user@test.com' })

    expect(result.success).toBe(true)
    expect(user.passwordStatus).toBe('must_change')
    expect(user.save).toHaveBeenCalled()
  })
})
