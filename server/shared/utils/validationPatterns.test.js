import { describe, it, expect } from 'vitest'
import patterns from './validationPatterns.js'

describe('validationPatterns', () => {
  describe('korean', () => {
    it('matches Hangul characters', () => {
      expect(patterns.korean.test('한글')).toBe(true)
    })

    it('does not match ASCII text', () => {
      expect(patterns.korean.test('abc')).toBe(false)
    })
  })

  describe('allowedBasic', () => {
    it('matches alphanumeric, dot, underscore', () => {
      expect(patterns.allowedBasic.test('Test.name_1')).toBe(true)
    })

    it('rejects dash', () => {
      expect(patterns.allowedBasic.test('test-name')).toBe(false)
    })

    it('rejects space', () => {
      expect(patterns.allowedBasic.test('test name')).toBe(false)
    })
  })

  describe('allowedWithDash', () => {
    it('matches alphanumeric, dot, underscore, dash', () => {
      expect(patterns.allowedWithDash.test('test-name')).toBe(true)
    })

    it('rejects space', () => {
      expect(patterns.allowedWithDash.test('test name')).toBe(false)
    })
  })

  describe('email', () => {
    it('matches valid email', () => {
      expect(patterns.email.test('a@b.c')).toBe(true)
    })

    it('rejects plain text', () => {
      expect(patterns.email.test('abc')).toBe(false)
    })

    it('rejects missing local part', () => {
      expect(patterns.email.test('@b.c')).toBe(false)
    })
  })

  describe('ipStrict', () => {
    it('matches valid IP 192.168.1.1', () => {
      expect(patterns.ipStrict.test('192.168.1.1')).toBe(true)
    })

    it('matches 0.0.0.0', () => {
      expect(patterns.ipStrict.test('0.0.0.0')).toBe(true)
    })

    it('matches 255.255.255.255', () => {
      expect(patterns.ipStrict.test('255.255.255.255')).toBe(true)
    })

    it('rejects octet > 255', () => {
      expect(patterns.ipStrict.test('256.1.1.1')).toBe(false)
    })

    it('rejects incomplete IP', () => {
      expect(patterns.ipStrict.test('1.2.3')).toBe(false)
    })
  })

  describe('date', () => {
    it('matches YYYY-MM-DD format', () => {
      expect(patterns.date.test('2024-01-01')).toBe(true)
    })

    it('rejects DD-MM-YYYY format', () => {
      expect(patterns.date.test('01-01-2024')).toBe(false)
    })
  })
})
