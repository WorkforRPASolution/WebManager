/**
 * EARS-based password reset — tests (TDD)
 *
 * Tests for searchEarsUsers, sendVerificationCode, verifyCodeAndResetPassword, setNewPassword
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { searchEarsUsers, sendVerificationCode, verifyCodeAndResetPassword, setNewPassword, _setDeps } from './service.js'

// --- Mock dependencies ---
const mockFindOne = vi.fn()
const mockSearchUsers = vi.fn()
const mockStoreCode = vi.fn()
const mockVerifyCode = vi.fn()
const mockSendEmailTo = vi.fn()
const mockBuildVerificationCodeEmail = vi.fn()
const mockBuildTempPasswordEmail = vi.fn()

const mockUpdateOne = vi.fn().mockResolvedValue({ modifiedCount: 1 })

_setDeps({
  User: { findOne: mockFindOne, findById: vi.fn(), updateOne: mockUpdateOne },
  searchUsers: mockSearchUsers,
  storeCode: mockStoreCode,
  verifyCode: mockVerifyCode,
  sendEmailTo: mockSendEmailTo,
  buildVerificationCodeEmail: mockBuildVerificationCodeEmail,
  buildTempPasswordEmail: mockBuildTempPasswordEmail
})

let originalMode

beforeEach(() => {
  vi.clearAllMocks()
  originalMode = process.env.OPERATION_MODE
  process.env.OPERATION_MODE = 'integrated'
  mockBuildVerificationCodeEmail.mockReturnValue('<html>verification</html>')
  mockBuildTempPasswordEmail.mockReturnValue('<html>temp password</html>')
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

// --- searchEarsUsers ---
describe('searchEarsUsers', () => {
  it('정상 검색 → earsService.searchUsers 결과 반환', async () => {
    mockSearchUsers.mockResolvedValue({
      success: true,
      data: [{ cn: 'Hong Gildong', department: 'IT', mail: 'hong@test.com', employeeNumber: '1234' }]
    })

    const result = await searchEarsUsers('Hong')

    expect(mockSearchUsers).toHaveBeenCalledWith('Hong')
    expect(result.success).toBe(true)
    expect(result.data).toHaveLength(1)
  })

  it('빈 값 → earsService 호출 결과 그대로 반환', async () => {
    mockSearchUsers.mockResolvedValue({ success: false, error: 'name is required' })

    const result = await searchEarsUsers('')

    expect(result.success).toBe(false)
  })
})

// --- sendVerificationCode ---
describe('sendVerificationCode', () => {
  it('정상 → storeCode + 이메일 발송', async () => {
    mockStoreCode.mockResolvedValue({ code: '123456' })

    const result = await sendVerificationCode('user@test.com')

    expect(mockStoreCode).toHaveBeenCalledWith('user@test.com')
    expect(mockBuildVerificationCodeEmail).toHaveBeenCalledWith('123456', 5)
    expect(mockSendEmailTo).toHaveBeenCalledWith(
      'user@test.com',
      '[WebManager] 인증 코드 안내',
      '<html>verification</html>'
    )
    expect(result.success).toBe(true)
  })

  it('쿨다운 중 → 에러 반환', async () => {
    mockStoreCode.mockResolvedValue({ error: '인증 코드 재발송 대기 중입니다. 잠시 후 다시 시도해주세요.' })

    const result = await sendVerificationCode('user@test.com')

    expect(result.success).toBe(false)
    expect(result.error).toContain('재발송 대기')
    expect(mockSendEmailTo).not.toHaveBeenCalled()
  })

  it('이메일 발송 실패 → 코드 저장은 성공, 발송 실패 안내', async () => {
    mockStoreCode.mockResolvedValue({ code: '123456' })
    mockSendEmailTo.mockResolvedValue({ sent: false, error: 'Redis not available' })

    const result = await sendVerificationCode('user@test.com')

    expect(result.success).toBe(false)
    expect(result.error).toContain('발송')
  })
})

// --- verifyCodeAndResetPassword ---
describe('verifyCodeAndResetPassword', () => {
  it('정상 → 코드 검증 + singleid 추출 + 사용자 입력 비밀번호로 저장 + active 상태', async () => {
    mockVerifyCode.mockResolvedValue({ success: true })
    const user = mockUser({ singleid: 'testuser' })

    const result = await verifyCodeAndResetPassword('testuser@test.com', '123456', 'NewPass123')

    expect(mockVerifyCode).toHaveBeenCalledWith('testuser@test.com', '123456')
    expect(mockFindOne).toHaveBeenCalledWith({ singleid: 'testuser' })
    expect(mockUpdateOne).toHaveBeenCalledWith(
      { _id: 'user123' },
      { $set: expect.objectContaining({ passwordStatus: 'normal', passwordResetRequestedAt: null, accountStatus: 'active' }) }
    )
    // password should be a bcrypt hash, not the original
    const setArg = mockUpdateOne.mock.calls[0][1].$set
    expect(setArg.password).toBeDefined()
    expect(setArg.password).not.toBe('$2a$12$existinghash')
    expect(setArg.accountStatus).toBe('active')
    // 임시 비밀번호 이메일 발송 없음
    expect(mockBuildTempPasswordEmail).not.toHaveBeenCalled()
    expect(mockSendEmailTo).not.toHaveBeenCalled()
    expect(result.success).toBe(true)
  })

  it('코드 틀림 → 에러', async () => {
    mockVerifyCode.mockResolvedValue({ success: false, error: '인증 코드가 일치하지 않습니다.' })

    const result = await verifyCodeAndResetPassword('user@test.com', '000000', 'NewPass123')

    expect(result.success).toBe(false)
    expect(result.error).toContain('일치하지 않')
    expect(mockFindOne).not.toHaveBeenCalled()
  })

  it('사용자 미존재 → 에러', async () => {
    mockVerifyCode.mockResolvedValue({ success: true })
    mockFindOne.mockResolvedValue(null)

    const result = await verifyCodeAndResetPassword('unknown@test.com', '123456', 'NewPass123')

    expect(result.success).toBe(false)
    expect(result.error).toContain('사용자')
  })

  it('만료 코드 → 에러', async () => {
    mockVerifyCode.mockResolvedValue({ success: false, error: '인증 코드가 만료되었거나 존재하지 않습니다.' })

    const result = await verifyCodeAndResetPassword('user@test.com', '123456', 'NewPass123')

    expect(result.success).toBe(false)
    expect(result.error).toContain('만료')
  })

  it('singleid 추출 확인 — mail의 @ 앞부분', async () => {
    mockVerifyCode.mockResolvedValue({ success: true })
    mockUser({ singleid: 'john.doe' })

    await verifyCodeAndResetPassword('john.doe@company.com', '123456', 'NewPass123')

    expect(mockFindOne).toHaveBeenCalledWith({ singleid: 'john.doe' })
  })
})

// --- setNewPassword ---
const mockFindById = vi.fn()
_setDeps({ User: { findOne: mockFindOne, findById: mockFindById, updateOne: mockUpdateOne } })

describe('setNewPassword', () => {
  it('비밀번호 설정 완료 시 accountStatus를 active로 변경', async () => {
    mockFindById.mockResolvedValue({
      _id: 'user123',
      passwordStatus: 'must_change'
    })

    const result = await setNewPassword('user123', 'NewPass123')

    expect(result.success).toBe(true)
    const setArg = mockUpdateOne.mock.calls[0][1].$set
    expect(setArg.accountStatus).toBe('active')
    expect(setArg.passwordStatus).toBe('normal')
  })

  it('passwordStatus가 must_change가 아니면 에러', async () => {
    mockFindById.mockResolvedValue({
      _id: 'user123',
      passwordStatus: 'normal'
    })

    const result = await setNewPassword('user123', 'NewPass123')

    expect(result.error).toContain('비밀번호 변경이 필요하지 않습니다')
    expect(mockUpdateOne).not.toHaveBeenCalled()
  })

  it('사용자 미존재 → 에러', async () => {
    mockFindById.mockResolvedValue(null)

    const result = await setNewPassword('nonexistent', 'NewPass123')

    expect(result.error).toBe('User not found')
  })
})
