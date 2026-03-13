import { describe, it, expect } from 'vitest'
import {
  flattenJson,
  buildKeyTree,
  computeDiff,
  filterDiffOnly
} from './configCompareUtils.js'

// ─── flattenJson ────────────────────────────────────────────

describe('flattenJson', () => {
  it('returns empty map for empty object', () => {
    const result = flattenJson({})
    expect(result.size).toBe(0)
  })

  it('flattens 1-depth object', () => {
    const result = flattenJson({ host: '0.0.0.0', port: 8080 })
    expect(result.get('host')).toEqual({ value: '0.0.0.0', type: 'string' })
    expect(result.get('port')).toEqual({ value: 8080, type: 'number' })
  })

  it('flattens nested object with dot-notation', () => {
    const result = flattenJson({ server: { host: '0.0.0.0', port: 8080 } })
    expect(result.get('server')).toEqual({ type: 'object' })
    expect(result.get('server.host')).toEqual({ value: '0.0.0.0', type: 'string' })
    expect(result.get('server.port')).toEqual({ value: 8080, type: 'number' })
  })

  it('flattens arrays with index keys', () => {
    const result = flattenJson({ items: ['a', 'b', 'c'] })
    expect(result.get('items')).toEqual({ type: 'array', length: 3 })
    expect(result.get('items.0')).toEqual({ value: 'a', type: 'string' })
    expect(result.get('items.1')).toEqual({ value: 'b', type: 'string' })
    expect(result.get('items.2')).toEqual({ value: 'c', type: 'string' })
  })

  it('handles null values', () => {
    const result = flattenJson({ key: null })
    expect(result.get('key')).toEqual({ value: null, type: 'null' })
  })

  it('handles boolean values', () => {
    const result = flattenJson({ enabled: true })
    expect(result.get('enabled')).toEqual({ value: true, type: 'boolean' })
  })

  it('handles deeply nested mixed structures', () => {
    const result = flattenJson({
      a: { b: { c: [1, { d: 'x' }] } }
    })
    expect(result.get('a')).toEqual({ type: 'object' })
    expect(result.get('a.b')).toEqual({ type: 'object' })
    expect(result.get('a.b.c')).toEqual({ type: 'array', length: 2 })
    expect(result.get('a.b.c.0')).toEqual({ value: 1, type: 'number' })
    expect(result.get('a.b.c.1')).toEqual({ type: 'object' })
    expect(result.get('a.b.c.1.d')).toEqual({ value: 'x', type: 'string' })
  })

  it('handles empty array', () => {
    const result = flattenJson({ arr: [] })
    expect(result.get('arr')).toEqual({ type: 'array', length: 0 })
  })

  it('handles empty nested object', () => {
    const result = flattenJson({ obj: {} })
    expect(result.get('obj')).toEqual({ type: 'object' })
  })
})

// ─── buildKeyTree ───────────────────────────────────────────

describe('buildKeyTree', () => {
  it('builds tree from single key', () => {
    const tree = buildKeyTree([['host']])
    expect(tree).toEqual([
      { key: 'host', fullPath: 'host', isLeaf: true, children: [], depth: 0 }
    ])
  })

  it('builds tree with sibling keys sorted alphabetically', () => {
    const tree = buildKeyTree([['port', 'host', 'timeout']])
    expect(tree.map(n => n.key)).toEqual(['host', 'port', 'timeout'])
  })

  it('builds nested tree from dot-paths', () => {
    const tree = buildKeyTree([['server', 'server.host', 'server.port']])
    expect(tree.length).toBe(1)
    expect(tree[0].key).toBe('server')
    expect(tree[0].isLeaf).toBe(false)
    expect(tree[0].children.map(c => c.key)).toEqual(['host', 'port'])
    expect(tree[0].children[0].fullPath).toBe('server.host')
    expect(tree[0].children[0].depth).toBe(1)
  })

  it('builds union from multiple key sets', () => {
    const tree = buildKeyTree([
      ['host', 'port'],
      ['host', 'timeout']
    ])
    expect(tree.map(n => n.key)).toEqual(['host', 'port', 'timeout'])
  })

  it('handles deep nesting', () => {
    const tree = buildKeyTree([['a', 'a.b', 'a.b.c', 'a.b.c.d']])
    expect(tree[0].key).toBe('a')
    expect(tree[0].children[0].key).toBe('b')
    expect(tree[0].children[0].children[0].key).toBe('c')
    expect(tree[0].children[0].children[0].children[0].key).toBe('d')
    expect(tree[0].children[0].children[0].children[0].depth).toBe(3)
  })
})

// ─── computeDiff ────────────────────────────────────────────

describe('computeDiff', () => {
  it('marks all identical when values match', () => {
    const maps = {
      EQP001: new Map([['host', { value: '0.0.0.0', type: 'string' }]]),
      EQP002: new Map([['host', { value: '0.0.0.0', type: 'string' }]])
    }
    const diff = computeDiff('EQP001', maps, ['host'])
    expect(diff.get('host').get('EQP002').isDifferent).toBe(false)
  })

  it('marks different when values differ', () => {
    const maps = {
      EQP001: new Map([['port', { value: 8080, type: 'number' }]]),
      EQP002: new Map([['port', { value: 8081, type: 'number' }]])
    }
    const diff = computeDiff('EQP001', maps, ['port'])
    expect(diff.get('port').get('EQP001').isDifferent).toBe(false)
    expect(diff.get('port').get('EQP002').isDifferent).toBe(true)
  })

  it('marks missing when key absent in a client', () => {
    const maps = {
      EQP001: new Map([['host', { value: '0.0.0.0', type: 'string' }]]),
      EQP002: new Map()
    }
    const diff = computeDiff('EQP001', maps, ['host'])
    expect(diff.get('host').get('EQP002').isMissing).toBe(true)
    expect(diff.get('host').get('EQP002').isDifferent).toBe(true)
  })

  it('handles type differences', () => {
    const maps = {
      EQP001: new Map([['val', { value: '8080', type: 'string' }]]),
      EQP002: new Map([['val', { value: 8080, type: 'number' }]])
    }
    const diff = computeDiff('EQP001', maps, ['val'])
    expect(diff.get('val').get('EQP002').isDifferent).toBe(true)
  })

  it('handles baseline key missing', () => {
    const maps = {
      EQP001: new Map(),
      EQP002: new Map([['extra', { value: 'x', type: 'string' }]])
    }
    const diff = computeDiff('EQP001', maps, ['extra'])
    expect(diff.get('extra').get('EQP001').isMissing).toBe(true)
    expect(diff.get('extra').get('EQP002').isDifferent).toBe(true)
  })

  it('skips non-leaf keys (object/array markers)', () => {
    const maps = {
      EQP001: new Map([
        ['server', { type: 'object' }],
        ['server.host', { value: '0.0.0.0', type: 'string' }]
      ]),
      EQP002: new Map([
        ['server', { type: 'object' }],
        ['server.host', { value: '0.0.0.0', type: 'string' }]
      ])
    }
    const diff = computeDiff('EQP001', maps, ['server', 'server.host'])
    // object markers should not have isDifferent
    expect(diff.has('server')).toBe(false)
    expect(diff.get('server.host').get('EQP001').isDifferent).toBe(false)
  })
})

// ─── filterDiffOnly ─────────────────────────────────────────

describe('filterDiffOnly', () => {
  it('returns empty set when all identical', () => {
    const diff = new Map([
      ['host', new Map([
        ['EQP001', { isDifferent: false }],
        ['EQP002', { isDifferent: false }]
      ])]
    ])
    const result = filterDiffOnly(diff)
    expect(result.size).toBe(0)
  })

  it('returns only keys with at least one difference', () => {
    const diff = new Map([
      ['host', new Map([
        ['EQP001', { isDifferent: false }],
        ['EQP002', { isDifferent: false }]
      ])],
      ['port', new Map([
        ['EQP001', { isDifferent: false }],
        ['EQP002', { isDifferent: true }]
      ])]
    ])
    const result = filterDiffOnly(diff)
    expect(result.has('port')).toBe(true)
    expect(result.has('host')).toBe(false)
  })

  it('includes parent paths of different keys', () => {
    const diff = new Map([
      ['server.host', new Map([
        ['EQP001', { isDifferent: false }],
        ['EQP002', { isDifferent: true }]
      ])],
      ['server.port', new Map([
        ['EQP001', { isDifferent: false }],
        ['EQP002', { isDifferent: false }]
      ])]
    ])
    const result = filterDiffOnly(diff)
    expect(result.has('server.host')).toBe(true)
    // parent path 'server' should be included for tree rendering
    expect(result.has('server')).toBe(true)
  })
})
