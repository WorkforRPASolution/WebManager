import { describe, it, expect } from 'vitest'
import { formatChartTimeLabel } from './chartFormatters'

describe('formatChartTimeLabel', () => {
  it('weekly + 10자 날짜 → "MM-DD~"', () => {
    expect(formatChartTimeLabel('2026-03-25', { isWeekly: true }))
      .toBe('03-25~')
  })

  it('daily + 10자 날짜 → "MM-DD"', () => {
    expect(formatChartTimeLabel('2026-03-25', { isHourly: false }))
      .toBe('03-25')
  })

  it('hourly + 16자 이상 → "HH:MM"', () => {
    expect(formatChartTimeLabel('2026-03-25 14:00', { isHourly: true }))
      .toBe('14:00')
  })

  it('기타 → 그대로 반환', () => {
    expect(formatChartTimeLabel('custom', {}))
      .toBe('custom')
  })

  it('weekly가 hourly보다 우선 (둘 다 true일 때)', () => {
    expect(formatChartTimeLabel('2026-03-25', { isHourly: true, isWeekly: true }))
      .toBe('03-25~')
  })

  it('옵션 없이 호출 시 기본값 적용', () => {
    // isHourly=undefined, isWeekly=undefined → !isHourly가 truthy → slice(5)
    expect(formatChartTimeLabel('2026-03-25'))
      .toBe('03-25')
  })
})
