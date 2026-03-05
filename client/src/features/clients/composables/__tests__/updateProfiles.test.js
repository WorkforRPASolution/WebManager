import { describe, it, expect } from 'vitest'
import { filterProfilesByClientOs } from '../updateProfileUtils'

describe('filterProfilesByClientOs', () => {
  const profiles = [
    { profileId: 'p1', name: 'Win v2', osVer: 'Windows 10', version: '2.0' },
    { profileId: 'p2', name: 'Lin v2', osVer: 'Ubuntu 20.04', version: '2.0' },
    { profileId: 'p3', name: 'All OS', osVer: '', version: '1.0' },
  ]

  it('클라이언트 OS와 일치하는 프로필 + osVer 비어있는 프로필', () => {
    const result = filterProfilesByClientOs(profiles, ['Windows 10'])
    expect(result).toHaveLength(2) // p1 + p3
    expect(result.map(p => p.profileId)).toEqual(['p1', 'p3'])
  })

  it('여러 OS의 클라이언트 → 해당 OS 프로필 모두 포함', () => {
    const result = filterProfilesByClientOs(profiles, ['Windows 10', 'Ubuntu 20.04'])
    expect(result).toHaveLength(3) // p1 + p2 + p3
  })

  it('매칭 없음 → osVer 비어있는 것만', () => {
    const result = filterProfilesByClientOs(profiles, ['CentOS 7'])
    expect(result).toHaveLength(1) // p3만
    expect(result[0].profileId).toBe('p3')
  })

  it('클라이언트 OS 비어있음 → 전체 프로필', () => {
    const result = filterProfilesByClientOs(profiles, [])
    expect(result).toHaveLength(3) // 전부
  })

  it('프로필 없음 → 빈 배열', () => {
    const result = filterProfilesByClientOs([], ['Windows 10'])
    expect(result).toHaveLength(0)
  })
})
