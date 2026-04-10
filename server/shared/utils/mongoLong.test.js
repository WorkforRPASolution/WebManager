/**
 * mongoLong utility tests
 */

import { describe, it, expect } from 'vitest'
import { toLong, ensureLongFields, stripNullFields, separateNullFields } from './mongoLong.js'

// bson ESM/CJS 모듈 중복으로 instanceof Long이 실패할 수 있으므로
// duck-typing으로 Long 여부를 판별
function isLong(value) {
  return value != null && typeof value === 'object' && typeof value.toNumber === 'function' && typeof value.low === 'number'
}

describe('mongoLong', () => {
  describe('toLong', () => {
    it('converts integer to Long', () => {
      const result = toLong(1)
      expect(isLong(result)).toBe(true)
      expect(result.toNumber()).toBe(1)
    })

    it('converts 0 to Long', () => {
      const result = toLong(0)
      expect(isLong(result)).toBe(true)
      expect(result.toNumber()).toBe(0)
    })

    it('returns null for null', () => {
      expect(toLong(null)).toBeNull()
    })

    it('returns undefined for undefined', () => {
      expect(toLong(undefined)).toBeUndefined()
    })

    it('converts string number to Long', () => {
      const result = toLong('42')
      expect(isLong(result)).toBe(true)
      expect(result.toNumber()).toBe(42)
    })

    it('preserves existing Long (idempotent)', () => {
      const first = toLong(5)
      const second = toLong(first)
      expect(second).toBe(first)
    })

    it('handles negative numbers', () => {
      const result = toLong(-1)
      expect(isLong(result)).toBe(true)
      expect(result.toNumber()).toBe(-1)
    })
  })

  describe('ensureLongFields', () => {
    it('converts specified flat fields to Long', () => {
      const data = { onoff: 1, localpc: 0, name: 'test' }
      const result = ensureLongFields(data, ['onoff', 'localpc'])
      expect(isLong(result.onoff)).toBe(true)
      expect(result.onoff.toNumber()).toBe(1)
      expect(isLong(result.localpc)).toBe(true)
      expect(result.localpc.toNumber()).toBe(0)
      expect(result.name).toBe('test')
    })

    it('converts dot-notation nested fields to Long', () => {
      const data = { agentPorts: { rpc: 7180, ftp: 7181, socks: 30000 } }
      const result = ensureLongFields(data, ['agentPorts.rpc', 'agentPorts.ftp', 'agentPorts.socks'])
      expect(isLong(result.agentPorts.rpc)).toBe(true)
      expect(result.agentPorts.rpc.toNumber()).toBe(7180)
      expect(isLong(result.agentPorts.ftp)).toBe(true)
      expect(isLong(result.agentPorts.socks)).toBe(true)
    })

    it('skips null/undefined fields', () => {
      const data = { onoff: 1, localpc: null, snapshotTimeDiff: undefined }
      const result = ensureLongFields(data, ['onoff', 'localpc', 'snapshotTimeDiff'])
      expect(isLong(result.onoff)).toBe(true)
      expect(result.localpc).toBeNull()
      expect(result.snapshotTimeDiff).toBeUndefined()
    })

    it('skips nested field when parent is absent', () => {
      const data = { onoff: 1 }
      const result = ensureLongFields(data, ['onoff', 'agentPorts.rpc'])
      expect(isLong(result.onoff)).toBe(true)
      expect(result.agentPorts).toBeUndefined()
    })

    it('does not mutate original data', () => {
      const ports = { rpc: 7180 }
      const data = { onoff: 1, agentPorts: ports }
      const result = ensureLongFields(data, ['onoff', 'agentPorts.rpc'])
      expect(data.onoff).toBe(1)
      expect(ports.rpc).toBe(7180)
      expect(isLong(result.onoff)).toBe(true)
      expect(isLong(result.agentPorts.rpc)).toBe(true)
    })

    it('returns empty object for empty data', () => {
      const result = ensureLongFields({}, ['onoff'])
      expect(result).toEqual({})
    })
  })

  describe('stripNullFields', () => {
    it('removes null fields', () => {
      const data = { onoff: toLong(1), serviceType: null, basePath: null }
      const result = stripNullFields(data)
      expect(isLong(result.onoff)).toBe(true)
      expect(result).not.toHaveProperty('serviceType')
      expect(result).not.toHaveProperty('basePath')
    })

    it('removes undefined fields', () => {
      const data = { onoff: toLong(1), snapshotTimeDiff: undefined }
      const result = stripNullFields(data)
      expect(isLong(result.onoff)).toBe(true)
      expect(result).not.toHaveProperty('snapshotTimeDiff')
    })

    it('strips null sub-fields from nested object', () => {
      const data = { agentPorts: { rpc: toLong(7180), ftp: null, socks: null } }
      const result = stripNullFields(data)
      expect(isLong(result.agentPorts.rpc)).toBe(true)
      expect(result.agentPorts).not.toHaveProperty('ftp')
      expect(result.agentPorts).not.toHaveProperty('socks')
    })

    it('removes entire nested object when all sub-fields are null', () => {
      const data = { name: 'test', agentPorts: { rpc: null, ftp: null, socks: null } }
      const result = stripNullFields(data)
      expect(result.name).toBe('test')
      expect(result).not.toHaveProperty('agentPorts')
    })

    it('preserves Long values', () => {
      const data = { onoff: toLong(1), localpc: toLong(0) }
      const result = stripNullFields(data)
      expect(isLong(result.onoff)).toBe(true)
      expect(isLong(result.localpc)).toBe(true)
    })

    it('preserves Date values', () => {
      const date = new Date()
      const data = { updatedAt: date, removed: null }
      const result = stripNullFields(data)
      expect(result.updatedAt).toBe(date)
      expect(result).not.toHaveProperty('removed')
    })

    it('preserves arrays', () => {
      const data = { tags: ['a', 'b'], removed: null }
      const result = stripNullFields(data)
      expect(result.tags).toEqual(['a', 'b'])
    })

    it('preserves empty strings and 0', () => {
      const data = { name: '', count: 0, removed: null }
      const result = stripNullFields(data)
      expect(result.name).toBe('')
      expect(result.count).toBe(0)
    })

    it('does not mutate original', () => {
      const data = { a: 1, b: null }
      const result = stripNullFields(data)
      expect(data.b).toBeNull()
      expect(result).not.toHaveProperty('b')
    })
  })

  describe('separateNullFields', () => {
    it('separates null fields into $unset', () => {
      const data = { onoff: toLong(1), serviceType: null, basePath: null }
      const { $set, $unset } = separateNullFields(data)
      expect(isLong($set.onoff)).toBe(true)
      expect($set).not.toHaveProperty('serviceType')
      expect($unset).toEqual({ serviceType: '', basePath: '' })
    })

    it('handles nested object with mixed null/non-null', () => {
      const data = { agentPorts: { rpc: toLong(7180), ftp: null, socks: toLong(30000) } }
      const { $set, $unset } = separateNullFields(data)
      // agentPorts은 null이 제거된 객체로 $set
      expect(isLong($set.agentPorts.rpc)).toBe(true)
      expect(isLong($set.agentPorts.socks)).toBe(true)
      expect($set.agentPorts).not.toHaveProperty('ftp')
      expect($unset).toEqual({})
    })

    it('unsets entire nested object when all sub-fields are null', () => {
      const data = { name: 'test', agentPorts: { rpc: null, ftp: null } }
      const { $set, $unset } = separateNullFields(data)
      expect($set.name).toBe('test')
      expect($set).not.toHaveProperty('agentPorts')
      expect($unset).toEqual({ agentPorts: '' })
    })

    it('returns empty $unset when no null fields', () => {
      const data = { onoff: toLong(1), name: 'test' }
      const { $set, $unset } = separateNullFields(data)
      expect(isLong($set.onoff)).toBe(true)
      expect($set.name).toBe('test')
      expect($unset).toEqual({})
    })

    it('returns empty $set when all fields are null', () => {
      const data = { serviceType: null, basePath: null }
      const { $set, $unset } = separateNullFields(data)
      expect($set).toEqual({})
      expect($unset).toEqual({ serviceType: '', basePath: '' })
    })

    it('handles undefined same as null', () => {
      const data = { onoff: toLong(1), basePath: undefined }
      const { $set, $unset } = separateNullFields(data)
      expect(isLong($set.onoff)).toBe(true)
      expect($unset).toEqual({ basePath: '' })
    })
  })
})
