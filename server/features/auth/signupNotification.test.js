/**
 * signup() — integrated mode notification email tests (TDD)
 *
 * Uses _setDeps() dependency injection for User model and email services.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock bcrypt to avoid slow hashing in tests
vi.mock('bcryptjs', () => ({
  default: { hash: vi.fn().mockResolvedValue('$hashed$'), compare: vi.fn() },
  hash: vi.fn().mockResolvedValue('$hashed$'),
  compare: vi.fn()
}))

const { signup, _setDeps } = await import('./service.js')

// --- Mock dependencies ---
const mockFindOne = vi.fn()
const mockFind = vi.fn()
const mockSave = vi.fn()
const mockSendEmailTo = vi.fn()

// Mock User as both constructor and model with static methods
function MockUser(data) {
  Object.assign(this, data)
  this.save = mockSave
}
MockUser.findOne = mockFindOne
MockUser.find = mockFind

_setDeps({
  User: MockUser,
  sendEmailTo: mockSendEmailTo
})

let originalMode

beforeEach(() => {
  vi.clearAllMocks()
  originalMode = process.env.OPERATION_MODE

  // Default: no duplicate user/email
  mockFindOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) })
  mockSave.mockResolvedValue(true)
  mockSendEmailTo.mockResolvedValue({ sent: true, subscribers: 1 })
})

afterEach(() => {
  if (originalMode === undefined) {
    delete process.env.OPERATION_MODE
  } else {
    process.env.OPERATION_MODE = originalMode
  }
})

const validUserData = {
  name: 'Test User',
  singleid: 'testuser',
  password: 'Password1',
  email: 'test@example.com',
  line: 'P1',
  processes: ['CVD'],
  department: 'Engineering',
  note: '',
  authorityManager: 0,
  authority: ''
}

describe('signup — integrated mode notification', () => {
  beforeEach(() => {
    process.env.OPERATION_MODE = 'integrated'
  })

  it('integrated 모드 + 가입 성공 → Admin에게 sendEmailTo 호출', async () => {
    mockFind.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          { email: 'admin1@test.com' },
          { email: 'admin2@test.com' }
        ])
      })
    })

    const result = await signup(validUserData)

    expect(result.success).toBe(true)
    expect(mockFind).toHaveBeenCalledWith({
      authorityManager: 1,
      accountStatus: 'active',
      email: { $ne: '' }
    })
    expect(mockSendEmailTo).toHaveBeenCalledTimes(2)
    expect(mockSendEmailTo).toHaveBeenCalledWith(
      'admin1@test.com',
      expect.stringContaining('신규 가입 요청'),
      expect.any(String)
    )
    expect(mockSendEmailTo).toHaveBeenCalledWith(
      'admin2@test.com',
      expect.stringContaining('신규 가입 요청'),
      expect.any(String)
    )
  })

  it('integrated 모드 + Admin 없음 → 에러 없이 가입 성공', async () => {
    mockFind.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([])
      })
    })

    const result = await signup(validUserData)

    expect(result.success).toBe(true)
    expect(mockSendEmailTo).not.toHaveBeenCalled()
  })

  it('integrated 모드 + 메일 발송 실패 → 가입은 성공', async () => {
    mockFind.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([{ email: 'admin@test.com' }])
      })
    })
    mockSendEmailTo.mockRejectedValue(new Error('Redis down'))

    const result = await signup(validUserData)

    expect(result.success).toBe(true)
    expect(result.user.singleid).toBe('testuser')
  })

  it('알림 메일 제목에 사용자 이름 포함', async () => {
    mockFind.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([{ email: 'admin@test.com' }])
      })
    })

    await signup(validUserData)

    expect(mockSendEmailTo).toHaveBeenCalledWith(
      'admin@test.com',
      expect.stringContaining('Test User'),
      expect.any(String)
    )
  })
})

describe('signup — standalone mode notification', () => {
  beforeEach(() => {
    delete process.env.OPERATION_MODE
  })

  it('standalone 모드 → sendEmailTo 미호출', async () => {
    const result = await signup(validUserData)

    expect(result.success).toBe(true)
    expect(mockSendEmailTo).not.toHaveBeenCalled()
  })
})

describe('signup — 기존 동작 유지', () => {
  beforeEach(() => {
    delete process.env.OPERATION_MODE
  })

  it('중복 ID → error 반환, 알림 미발송', async () => {
    mockFindOne.mockReturnValue({ lean: vi.fn().mockResolvedValue({ singleid: 'testuser' }) })

    const result = await signup(validUserData)

    expect(result.error).toBe('singleid')
    expect(mockSendEmailTo).not.toHaveBeenCalled()
  })
})
