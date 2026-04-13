import { describe, it, expect } from 'vitest'
import { mapEarsUserToRow } from '../earsUserMapping'

describe('mapEarsUserToRow', () => {
  it('M1: 정상 매핑 → singleid=메일앞, name=cn, department', () => {
    const result = mapEarsUserToRow({
      mail: 'hong@test.com',
      cn: '홍길동',
      department: '개발팀'
    })
    expect(result).toEqual({
      singleid: 'hong',
      name: '홍길동',
      department: '개발팀'
    })
  })

  it('M2: mail 없음 → singleid 빈 문자열', () => {
    const result = mapEarsUserToRow({ cn: '홍길동', department: '개발팀' })
    expect(result.singleid).toBe('')
  })

  it('M3: cn/department 없음 → 빈 문자열', () => {
    const result = mapEarsUserToRow({ mail: 'hong@test.com' })
    expect(result.name).toBe('')
    expect(result.department).toBe('')
  })

  it('M4: mail에 @ 없음 → 전체 문자열 그대로', () => {
    const result = mapEarsUserToRow({ mail: 'hongtest', cn: 'A' })
    expect(result.singleid).toBe('hongtest')
  })
})
