import { describe, it, expect } from 'vitest'
import { validateClientData, validateBatchCreate, patterns } from './validation.js'

/**
 * Helper: minimal valid client data to pass all validations
 */
function makeValidClient(overrides = {}) {
  return {
    line: 'LINE_A',
    lineDesc: 'LineA',
    process: 'PHOTO',
    eqpModel: 'MODEL1',
    eqpId: 'EQP001',
    category: 'CAT1',
    ipAddr: '10.0.0.1',
    emailcategory: 'email-cat',
    osVer: 'Win10',
    localpc: 0,
    onoff: 1,
    webmanagerUse: 1,
    usereleasemsg: 0,
    usetkincancel: 0,
    ...overrides
  }
}

describe('validateClientData', () => {
  it('필수 필드 누락 시 에러', () => {
    const data = { ipAddr: '10.0.0.1' }
    const errors = validateClientData(data)

    expect(errors).not.toBeNull()
    // All required string fields except ipAddr should be in errors
    expect(errors.line).toBeDefined()
    expect(errors.process).toBeDefined()
    expect(errors.eqpId).toBeDefined()
    expect(errors.eqpModel).toBeDefined()
  })

  it('한글 문자 포함 시 에러', () => {
    const data = makeValidClient({ process: '포토' })
    const errors = validateClientData(data)

    expect(errors).not.toBeNull()
    expect(errors.process).toContain('한글')
  })

  it('허용되지 않는 특수문자 시 에러', () => {
    const data = makeValidClient({ eqpModel: 'MODEL@#!' })
    const errors = validateClientData(data)

    expect(errors).not.toBeNull()
    expect(errors.eqpModel).toBeDefined()
  })

  it('ipAddr 옥텟 범위 초과(256.1.1.1) 시 에러', () => {
    const data = makeValidClient({ ipAddr: '256.1.1.1' })
    const errors = validateClientData(data)

    expect(errors).not.toBeNull()
    expect(errors.ipAddr).toBeDefined()
    expect(errors.ipAddr).toContain('IPv4')
  })

  it('dash 허용 필드(line)에서 dash 정상 통과', () => {
    const data = makeValidClient({ line: 'LINE-A' })
    const errors = validateClientData(data)

    expect(errors).toBeNull()
  })

  it('정상 데이터 → null 반환', () => {
    const data = makeValidClient()
    const errors = validateClientData(data)

    expect(errors).toBeNull()
  })
})

describe('validateBatchCreate', () => {
  it('배치 내 중복 키 → errors에 충돌 대상 포함', () => {
    const clients = [
      makeValidClient({ eqpId: 'EQP001', ipAddr: '10.0.0.1' }),
      makeValidClient({ eqpId: 'EQP001', ipAddr: '10.0.0.2' })  // duplicate eqpId
    ]

    const emptyEqpIds = new Set()
    emptyEqpIds._originals = new Map()
    const result = validateBatchCreate(clients, emptyEqpIds, new Map())

    expect(result.errors.length).toBeGreaterThan(0)
    const eqpIdError = result.errors.find(e => e.field === 'eqpId')
    expect(eqpIdError).toBeDefined()
    expect(eqpIdError.message).toContain('중복')
  })

  it('기존 레코드와 충돌 → errors에 충돌 eqpId 표시', () => {
    const clients = [
      makeValidClient({ eqpId: 'EQP_NEW', ipAddr: '10.0.0.5' })
    ]
    const existingEqpIds = new Set(['eqp_new'])
    existingEqpIds._originals = new Map([['eqp_new', 'EQP_NEW']])
    const existingIpCombos = new Map([['10.0.0.99|', 'EQP_NEW']])

    const result = validateBatchCreate(clients, existingEqpIds, existingIpCombos)

    expect(result.errors.length).toBeGreaterThan(0)
    const eqpIdError = result.errors.find(e => e.field === 'eqpId')
    expect(eqpIdError).toBeDefined()
    expect(eqpIdError.message).toContain('EQP_NEW')
  })

  it('정상 배치 → valid 배열에 모든 항목', () => {
    const clients = [
      makeValidClient({ eqpId: 'EQP001', ipAddr: '10.0.0.1' }),
      makeValidClient({ eqpId: 'EQP002', ipAddr: '10.0.0.2' }),
      makeValidClient({ eqpId: 'EQP003', ipAddr: '10.0.0.3' })
    ]

    const emptyEqpIds = new Set()
    emptyEqpIds._originals = new Map()
    const result = validateBatchCreate(clients, emptyEqpIds, new Map())

    expect(result.errors).toHaveLength(0)
    expect(result.valid).toHaveLength(3)
  })
})

describe('patterns', () => {
  it('ipStrict rejects 256.1.1.1', () => {
    expect(patterns.ipStrict.test('256.1.1.1')).toBe(false)
  })

  it('ipStrict accepts 255.0.0.1', () => {
    expect(patterns.ipStrict.test('255.0.0.1')).toBe(true)
  })

  it('korean detects Hangul', () => {
    expect(patterns.korean.test('테스트')).toBe(true)
    expect(patterns.korean.test('test')).toBe(false)
  })

  it('allowedBasic rejects dash', () => {
    expect(patterns.allowedBasic.test('LINE-A')).toBe(false)
  })

  it('allowedWithDash accepts dash', () => {
    expect(patterns.allowedWithDash.test('LINE-A')).toBe(true)
  })
})
