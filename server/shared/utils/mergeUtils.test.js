import { describe, it, expect } from 'vitest'
import { deepMerge } from './mergeUtils.js'

describe('deepMerge', () => {
  it('merges flat objects', () => {
    expect(deepMerge({ a: 1 }, { b: 2 })).toEqual({ a: 1, b: 2 })
  })

  it('overwrites primitive values', () => {
    expect(deepMerge({ a: 1 }, { a: 2 })).toEqual({ a: 2 })
  })

  it('deep merges nested objects', () => {
    const target = { a: { x: 1, y: 2 } }
    const source = { a: { y: 3, z: 4 } }
    expect(deepMerge(target, source)).toEqual({ a: { x: 1, y: 3, z: 4 } })
  })

  it('replaces arrays (no merge)', () => {
    const target = { a: [1, 2] }
    const source = { a: [3, 4, 5] }
    expect(deepMerge(target, source)).toEqual({ a: [3, 4, 5] })
  })

  it('does not mutate target', () => {
    const target = { a: { x: 1 } }
    const source = { a: { y: 2 } }
    const result = deepMerge(target, source)
    expect(target).toEqual({ a: { x: 1 } })
    expect(result).toEqual({ a: { x: 1, y: 2 } })
  })

  it('deep clones source values', () => {
    const source = { a: { nested: [1, 2] } }
    const result = deepMerge({}, source)
    result.a.nested.push(3)
    expect(source.a.nested).toEqual([1, 2])
  })

  it('handles null source values', () => {
    expect(deepMerge({ a: 1 }, { a: null })).toEqual({ a: null })
  })
})
