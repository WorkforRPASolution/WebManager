/**
 * Drift detector: server LOG_TYPE_TO_DATE_AXIS 와 client schema.js 의
 * LOG_TYPE_REGISTRY 가 동기화되어 있는지 검증.
 *
 * 새 log_type 추가 시 둘 중 하나만 업데이트하면 원격 테스트가 silent
 * fallback ('normal') 되어 잘못된 결과를 내므로 이 테스트로 사전 차단.
 */
import { describe, it, expect } from 'vitest'
import { LOG_TYPE_REGISTRY } from '../../../client/src/features/clients/components/config-form/accesslog/schema.js'

const { LOG_TYPE_TO_DATE_AXIS } = require('./configTestController.js')

describe('server LOG_TYPE_TO_DATE_AXIS ↔ client LOG_TYPE_REGISTRY sync', () => {
  it('client 의 모든 canonical 이름이 server map 에 존재하고 dateAxis 가 일치', () => {
    for (const entry of LOG_TYPE_REGISTRY) {
      expect(LOG_TYPE_TO_DATE_AXIS[entry.canonical], `missing canonical: ${entry.canonical}`).toBe(entry.date)
    }
  })

  it('client 의 모든 oldName 이 server map 에 존재하고 dateAxis 가 일치', () => {
    for (const entry of LOG_TYPE_REGISTRY) {
      if (!entry.oldName) continue
      expect(LOG_TYPE_TO_DATE_AXIS[entry.oldName], `missing oldName: ${entry.oldName}`).toBe(entry.date)
    }
  })

  it('server map 에 client 에 없는 항목이 없어야 함 (stale entry 차단)', () => {
    const allowed = new Set()
    for (const entry of LOG_TYPE_REGISTRY) {
      allowed.add(entry.canonical)
      if (entry.oldName) allowed.add(entry.oldName)
    }
    for (const key of Object.keys(LOG_TYPE_TO_DATE_AXIS)) {
      expect(allowed.has(key), `stale key in server map: ${key}`).toBe(true)
    }
  })
})
