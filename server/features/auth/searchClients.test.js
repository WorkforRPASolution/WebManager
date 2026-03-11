/**
 * searchClients — tests (TDD)
 *
 * Uses _setDeps() dependency injection for Client model.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { searchClientsByKeyword, _setDeps } from './service.js'

const mockFind = vi.fn()

_setDeps({
  Client: {
    find: (...args) => ({
      select: () => ({ lean: () => mockFind(...args) })
    })
  }
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('searchClientsByKeyword', () => {
  it('키워드로 eqpId, ipAddr 부분 매칭 검색', async () => {
    mockFind.mockResolvedValue([
      { eqpId: 'CVD_EQP_01', ipAddr: '10.0.1.10', process: 'CVD' },
      { eqpId: 'CVD_EQP_02', ipAddr: '10.0.1.11', process: 'CVD' }
    ])

    const result = await searchClientsByKeyword('CVD')
    expect(result.clients).toHaveLength(2)
    expect(result.processes).toEqual(['CVD'])
  })

  it('여러 Process에 걸친 결과 → processes 중복 제거 및 정렬', async () => {
    mockFind.mockResolvedValue([
      { eqpId: 'EQP_01', ipAddr: '10.0.1.10', process: 'ETCH' },
      { eqpId: 'EQP_02', ipAddr: '10.0.1.11', process: 'CVD' },
      { eqpId: 'EQP_03', ipAddr: '10.0.1.12', process: 'ETCH' }
    ])

    const result = await searchClientsByKeyword('10.0.1')
    expect(result.clients).toHaveLength(3)
    expect(result.processes).toEqual(['CVD', 'ETCH'])
  })

  it('결과 없음 → 빈 배열', async () => {
    mockFind.mockResolvedValue([])

    const result = await searchClientsByKeyword('nonexistent')
    expect(result.clients).toEqual([])
    expect(result.processes).toEqual([])
  })

  it('키워드 2자 미만 → throw', async () => {
    await expect(searchClientsByKeyword('a')).rejects.toThrow('2자 이상')
  })

  it('빈 문자열 → throw', async () => {
    await expect(searchClientsByKeyword('')).rejects.toThrow('2자 이상')
  })

  it('결과가 50건 초과 → 50건으로 제한', async () => {
    const manyClients = Array.from({ length: 60 }, (_, i) => ({
      eqpId: `EQP_${i}`, ipAddr: `10.0.1.${i}`, process: 'CVD'
    }))
    mockFind.mockResolvedValue(manyClients)

    const result = await searchClientsByKeyword('EQP')
    expect(result.clients).toHaveLength(50)
  })
})
