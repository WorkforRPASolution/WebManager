import { describe, it, expect } from 'vitest'
import { parseCommaSeparated } from './parseUtils.js'

describe('parseCommaSeparated', () => {
  it('splits comma-separated string and trims', () => {
    expect(parseCommaSeparated('a, b, c')).toEqual(['a', 'b', 'c'])
  })

  it('filters empty strings', () => {
    expect(parseCommaSeparated('a,,b,  ,c')).toEqual(['a', 'b', 'c'])
  })

  it('returns null for null/undefined/empty', () => {
    expect(parseCommaSeparated(null)).toBeNull()
    expect(parseCommaSeparated(undefined)).toBeNull()
    expect(parseCommaSeparated('')).toBeNull()
  })

  it('returns single-element array for no-comma string', () => {
    expect(parseCommaSeparated('hello')).toEqual(['hello'])
  })
})
