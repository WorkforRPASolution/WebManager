/**
 * signup() — integrated mode notification email tests (TDD)
 *
 * Admin 알림 메일: EARS InterfaceServer로 이메일 조회 후 발송
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
const mockSearchUsers = vi.fn()

// Mock User as both constructor and model with static methods
function MockUser(data) {
  Object.assign(this, data)
  this.save = mockSave
}
MockUser.findOne = mockFindOne
MockUser.find = mockFind

_setDeps({
  User: MockUser,
  sendEmailTo: mockSendEmailTo,
  searchUsers: mockSearchUsers
})

let originalMode

beforeEach(() => {
  vi.clearAllMocks()
  originalMode = process.env.OPERATION_MODE

  // Default: no duplicate user/email
  mockFindOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) })
  mockSave.mockResolvedValue(true)
  mockSendEmailTo.mockResolvedValue({ sent: true, subscribers: 1 })
  mockSearchUsers.mockResolvedValue({ success: true, data: [] })
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

describe('signup — integrated mode: EARS 경유 Admin 알림 메일', () => {
  beforeEach(() => {
    process.env.OPERATION_MODE = 'integrated'
  })

  it('Admin별 EARS 검색 → mail 매칭 → sendEmailTo 호출', async () => {
    mockFind.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          { singleid: 'admin1', name: '김관리' },
          { singleid: 'admin2', name: '이관리' }
        ])
      })
    })
    // EARS 검색 결과: admin1은 매칭, admin2도 매칭
    mockSearchUsers
      .mockResolvedValueOnce({ success: true, data: [
        { cn: '김관리', mail: 'admin1@company.com', department: 'IT' }
      ]})
      .mockResolvedValueOnce({ success: true, data: [
        { cn: '이관리', mail: 'admin2@company.com', department: 'HR' }
      ]})

    const result = await signup(validUserData)

    expect(result.success).toBe(true)
    // Admin 조회: email 조건 없이 singleid, name 조회
    expect(mockFind).toHaveBeenCalledWith({
      authorityManager: 1,
      accountStatus: 'active'
    })
    // EARS 검색 각 Admin name으로 호출
    expect(mockSearchUsers).toHaveBeenCalledTimes(2)
    expect(mockSearchUsers).toHaveBeenCalledWith('김관리')
    expect(mockSearchUsers).toHaveBeenCalledWith('이관리')
    // EARS에서 받은 mail로 발송
    expect(mockSendEmailTo).toHaveBeenCalledTimes(2)
    expect(mockSendEmailTo).toHaveBeenCalledWith(
      'admin1@company.com',
      expect.stringContaining('신규 가입 요청'),
      expect.any(String)
    )
    expect(mockSendEmailTo).toHaveBeenCalledWith(
      'admin2@company.com',
      expect.stringContaining('신규 가입 요청'),
      expect.any(String)
    )
  })

  it('EARS에서 singleid 불일치 → 해당 Admin 스킵', async () => {
    mockFind.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          { singleid: 'admin1', name: '김관리' }
        ])
      })
    })
    // EARS 결과의 mail prefix가 singleid와 불일치
    mockSearchUsers.mockResolvedValue({ success: true, data: [
      { cn: '김관리', mail: 'other_person@company.com', department: 'IT' }
    ]})

    const result = await signup(validUserData)

    expect(result.success).toBe(true)
    expect(mockSearchUsers).toHaveBeenCalledWith('김관리')
    expect(mockSendEmailTo).not.toHaveBeenCalled()
  })

  it('EARS 검색 실패 → 에러 없이 가입 성공', async () => {
    mockFind.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          { singleid: 'admin1', name: '김관리' }
        ])
      })
    })
    mockSearchUsers.mockResolvedValue({ success: false, error: 'EARS unavailable' })

    const result = await signup(validUserData)

    expect(result.success).toBe(true)
    expect(mockSendEmailTo).not.toHaveBeenCalled()
  })

  it('Admin 없음 → EARS 검색 미호출, 가입 성공', async () => {
    mockFind.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([])
      })
    })

    const result = await signup(validUserData)

    expect(result.success).toBe(true)
    expect(mockSearchUsers).not.toHaveBeenCalled()
    expect(mockSendEmailTo).not.toHaveBeenCalled()
  })

  it('메일 발송 실패 → 가입은 성공', async () => {
    mockFind.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          { singleid: 'admin1', name: '김관리' }
        ])
      })
    })
    mockSearchUsers.mockResolvedValue({ success: true, data: [
      { cn: '김관리', mail: 'admin1@company.com', department: 'IT' }
    ]})
    mockSendEmailTo.mockRejectedValue(new Error('Redis down'))

    const result = await signup(validUserData)

    expect(result.success).toBe(true)
    expect(result.user.singleid).toBe('testuser')
  })

  it('알림 메일 제목에 가입자 이름 포함', async () => {
    mockFind.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          { singleid: 'admin1', name: '김관리' }
        ])
      })
    })
    mockSearchUsers.mockResolvedValue({ success: true, data: [
      { cn: '김관리', mail: 'admin1@company.com', department: 'IT' }
    ]})

    await signup(validUserData)

    expect(mockSendEmailTo).toHaveBeenCalledWith(
      'admin1@company.com',
      expect.stringContaining('Test User'),
      expect.any(String)
    )
  })
})

describe('signup — standalone mode notification', () => {
  beforeEach(() => {
    delete process.env.OPERATION_MODE
  })

  it('standalone 모드 → searchUsers/sendEmailTo 미호출', async () => {
    const result = await signup(validUserData)

    expect(result.success).toBe(true)
    expect(mockSearchUsers).not.toHaveBeenCalled()
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
