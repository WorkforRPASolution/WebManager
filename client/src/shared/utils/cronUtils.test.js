import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  parseCronString,
  composeCronString,
  matchPreset,
  computeNextFires,
  describeCron,
  CRON_PRESETS,
  FIELD_LABELS
} from './cronUtils'

describe('parseCronString', () => {
  it('6필드 정상 — 객체 반환', () => {
    const result = parseCronString('0 * * * * ?')
    expect(result.ok).toBe(true)
    expect(result.fields).toEqual({
      second: '0', minute: '*', hour: '*', dayOfMonth: '*', month: '*', dayOfWeek: '?'
    })
  })

  it('7필드(year 포함) 정상 — fields.year 포함', () => {
    const result = parseCronString('0 0 12 * * ? 2026')
    expect(result.ok).toBe(true)
    expect(result.fields.year).toBe('2026')
  })

  it('5필드는 에러', () => {
    const result = parseCronString('* * * * *')
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/6.*7.*field/i)
  })

  it('빈 문자열은 에러', () => {
    expect(parseCronString('').ok).toBe(false)
    expect(parseCronString('   ').ok).toBe(false)
  })

  it('좌우 공백·다중 공백 허용', () => {
    const result = parseCronString('  0   *  * * *  ? ')
    expect(result.ok).toBe(true)
    expect(result.fields.second).toBe('0')
  })
})

describe('composeCronString', () => {
  it('6필드 → 공백 join', () => {
    const str = composeCronString({
      second: '0', minute: '*', hour: '*', dayOfMonth: '*', month: '*', dayOfWeek: '?'
    })
    expect(str).toBe('0 * * * * ?')
  })

  it('year 포함 시 7필드 join', () => {
    const str = composeCronString({
      second: '0', minute: '0', hour: '12', dayOfMonth: '*', month: '*', dayOfWeek: '?', year: '2026'
    })
    expect(str).toBe('0 0 12 * * ? 2026')
  })

  it('parse → compose round-trip', () => {
    const original = '0 */5 * ? * MON'
    const parsed = parseCronString(original)
    expect(composeCronString(parsed.fields)).toBe(original)
  })

  it('누락 필드는 * 로 채움', () => {
    const str = composeCronString({ second: '0' })
    expect(str).toBe('0 * * * * *')
  })
})

describe('matchPreset', () => {
  it('프리셋 일치 시 해당 라벨 반환', () => {
    expect(matchPreset('0 * * * * ?')).toBe('매 분')
    expect(matchPreset('0 */5 * * * ?')).toBe('매 5분')
    expect(matchPreset('0 0 9 ? * MON')).toBe('매주 월요일 09:00')
  })

  it('프리셋에 없으면 null', () => {
    expect(matchPreset('0 */3 * * * ?')).toBeNull()
    expect(matchPreset('0 45 13 * * ?')).toBeNull()
  })

  it('공백 정규화 후 일치 판정', () => {
    expect(matchPreset('  0   *  * * *  ? ')).toBe('매 분')
  })

  it('CRON_PRESETS 배열 자체 검증 — 최소 6개', () => {
    expect(CRON_PRESETS.length).toBeGreaterThanOrEqual(6)
    // 각 프리셋은 label + expression 필드 필수
    for (const p of CRON_PRESETS) {
      expect(p.label).toBeTruthy()
      expect(p.expression).toBeTruthy()
    }
  })
})

describe('computeNextFires', () => {
  beforeEach(() => {
    // 고정 시각: 2026-04-23 10:15:30 UTC
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-23T10:15:30Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('매 분 — 다음 3회', () => {
    const result = computeNextFires('0 * * * * ?', 3)
    expect(result.ok).toBe(true)
    expect(result.fires).toHaveLength(3)
    // 10:15:30에서 매 분 0초이므로 다음은 10:16:00, 10:17:00, 10:18:00
    expect(result.fires[0].toISOString()).toBe('2026-04-23T10:16:00.000Z')
    expect(result.fires[1].toISOString()).toBe('2026-04-23T10:17:00.000Z')
    expect(result.fires[2].toISOString()).toBe('2026-04-23T10:18:00.000Z')
  })

  it('매 5분 — 다음 2회', () => {
    const result = computeNextFires('0 */5 * * * ?', 2)
    expect(result.ok).toBe(true)
    // 10:15:30 이후 매 5분 = 10:20:00, 10:25:00
    expect(result.fires[0].toISOString()).toBe('2026-04-23T10:20:00.000Z')
    expect(result.fires[1].toISOString()).toBe('2026-04-23T10:25:00.000Z')
  })

  it('잘못된 표현식 — ok:false + error', () => {
    const result = computeNextFires('invalid expr', 3)
    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('6필드 미만 — ok:false', () => {
    const result = computeNextFires('* * * * *', 3)
    expect(result.ok).toBe(false)
  })
})

describe('describeCron', () => {
  it('한국어 로케일 기본', () => {
    expect(describeCron('0 * * * * ?')).toMatch(/1분마다|분|매/)
  })

  it('다른 표현식도 한국어 설명', () => {
    const desc = describeCron('0 0 9 * * ?')
    expect(desc).toBeTruthy()
    expect(typeof desc).toBe('string')
  })

  it('잘못된 표현식 — null 반환 (throw 하지 않음)', () => {
    expect(describeCron('invalid')).toBeNull()
  })
})

describe('FIELD_LABELS', () => {
  it('6필드 + year 라벨 정의', () => {
    expect(FIELD_LABELS.second).toBe('초')
    expect(FIELD_LABELS.minute).toBe('분')
    expect(FIELD_LABELS.hour).toBe('시')
    expect(FIELD_LABELS.dayOfMonth).toBe('일')
    expect(FIELD_LABELS.month).toBe('월')
    expect(FIELD_LABELS.dayOfWeek).toBe('요일')
  })
})
