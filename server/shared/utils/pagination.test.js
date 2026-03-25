import { describe, it, expect } from 'vitest'
import { parsePaginationParams, getPaginationMeta, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from './pagination.js'

describe('parsePaginationParams', () => {
  it('정상 숫자 → 그대로 반환', () => {
    const result = parsePaginationParams({ page: '3', pageSize: '20' })
    expect(result).toEqual({ page: 3, pageSize: 20, skip: 40, limit: 20 })
  })

  it('빈 값 → 기본값', () => {
    const result = parsePaginationParams({})
    expect(result).toEqual({ page: 1, pageSize: DEFAULT_PAGE_SIZE, skip: 0, limit: DEFAULT_PAGE_SIZE })
  })

  it('NaN 문자열 → 기본값', () => {
    const result = parsePaginationParams({ page: 'abc', pageSize: 'xyz' })
    expect(result.page).toBe(1)
    expect(result.pageSize).toBe(DEFAULT_PAGE_SIZE)
  })

  it('불완전 숫자 → 기본값 (parseInt "2abc" = 2 방지)', () => {
    const result = parsePaginationParams({ pageSize: '2abc' })
    expect(result.pageSize).toBe(DEFAULT_PAGE_SIZE)
  })

  it('음수 → 최소값 적용', () => {
    const result = parsePaginationParams({ pageSize: '-5' })
    expect(result.pageSize).toBe(1) // MIN_PAGE_SIZE
  })

  it('초과 → 최대값 적용', () => {
    const result = parsePaginationParams({ pageSize: '999' })
    expect(result.pageSize).toBe(MAX_PAGE_SIZE)
  })

  it('소수점 → 정수 부분만 사용', () => {
    const result = parsePaginationParams({ pageSize: '25.7' })
    expect(result.pageSize).toBe(25)
  })

  it('page 0 또는 음수 → 최소 1', () => {
    expect(parsePaginationParams({ page: '0' }).page).toBe(1)
    expect(parsePaginationParams({ page: '-3' }).page).toBe(1)
  })

  it('custom options 적용', () => {
    const result = parsePaginationParams({ pageSize: '5' }, { minPageSize: 10 })
    expect(result.pageSize).toBe(10) // minPageSize 적용
  })
})

describe('getPaginationMeta', () => {
  it('totalPages 계산 정확성', () => {
    const meta = getPaginationMeta(101, 1, 50)
    expect(meta.totalPages).toBe(3) // ceil(101/50) = 3
    expect(meta.hasNextPage).toBe(true)
    expect(meta.hasPrevPage).toBe(false)
  })

  it('마지막 페이지 경계값', () => {
    const meta = getPaginationMeta(100, 2, 50)
    expect(meta.totalPages).toBe(2)
    expect(meta.hasNextPage).toBe(false)
    expect(meta.hasPrevPage).toBe(true)
  })

  it('total 0일 때 totalPages 최소 1', () => {
    const meta = getPaginationMeta(0, 1, 50)
    expect(meta.totalPages).toBe(1)
    expect(meta.hasNextPage).toBe(false)
  })
})
