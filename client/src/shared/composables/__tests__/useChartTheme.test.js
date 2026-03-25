import { describe, it, expect, vi } from 'vitest'

// Mock useTheme before importing the composable
vi.mock('../useTheme', () => ({
  useTheme: () => ({ isDark: { value: false } })
}))

import { useChartTheme } from '../useChartTheme.js'

describe('useChartTheme', () => {
  it('returns expected API shape', () => {
    const api = useChartTheme()
    expect(api.isDark).toBeDefined()
    expect(api.tooltipStyle).toBeTypeOf('function')
    expect(api.axisLabelStyle).toBeTypeOf('function')
    expect(api.categoryAxisLabelStyle).toBeTypeOf('function')
    expect(api.splitLineStyle).toBeTypeOf('function')
    expect(api.legendStyle).toBeTypeOf('function')
    expect(api.axisLineStyle).toBeTypeOf('function')
  })

  describe('tooltipStyle', () => {
    it('returns dark colors when dark=true', () => {
      const { tooltipStyle } = useChartTheme()
      const style = tooltipStyle(true)
      expect(style.backgroundColor).toBe('#1f2937')
      expect(style.borderColor).toBe('#374151')
      expect(style.textStyle.color).toBe('#e5e7eb')
    })

    it('returns light colors when dark=false', () => {
      const { tooltipStyle } = useChartTheme()
      const style = tooltipStyle(false)
      expect(style.backgroundColor).toBe('#fff')
      expect(style.borderColor).toBe('#e5e7eb')
      expect(style.textStyle.color).toBe('#111827')
    })
  })

  describe('axisLabelStyle', () => {
    it('returns muted gray for dark mode', () => {
      const { axisLabelStyle } = useChartTheme()
      expect(axisLabelStyle(true).color).toBe('#9ca3af')
    })

    it('returns muted gray for light mode', () => {
      const { axisLabelStyle } = useChartTheme()
      expect(axisLabelStyle(false).color).toBe('#6b7280')
    })
  })

  describe('categoryAxisLabelStyle', () => {
    it('returns brighter color for dark mode', () => {
      const { categoryAxisLabelStyle } = useChartTheme()
      expect(categoryAxisLabelStyle(true).color).toBe('#d1d5db')
    })

    it('returns darker color for light mode', () => {
      const { categoryAxisLabelStyle } = useChartTheme()
      expect(categoryAxisLabelStyle(false).color).toBe('#374151')
    })
  })

  describe('splitLineStyle', () => {
    it('returns correct lineStyle for dark mode', () => {
      const { splitLineStyle } = useChartTheme()
      const style = splitLineStyle(true)
      expect(style.lineStyle.color).toBe('#374151')
    })

    it('returns correct lineStyle for light mode', () => {
      const { splitLineStyle } = useChartTheme()
      const style = splitLineStyle(false)
      expect(style.lineStyle.color).toBe('#e5e7eb')
    })
  })

  describe('legendStyle', () => {
    it('returns correct color for dark mode', () => {
      const { legendStyle } = useChartTheme()
      expect(legendStyle(true).color).toBe('#9ca3af')
    })

    it('returns correct color for light mode', () => {
      const { legendStyle } = useChartTheme()
      expect(legendStyle(false).color).toBe('#6b7280')
    })
  })

  describe('axisLineStyle', () => {
    it('returns correct lineStyle for dark mode', () => {
      const { axisLineStyle } = useChartTheme()
      expect(axisLineStyle(true).lineStyle.color).toBe('#374151')
    })

    it('returns correct lineStyle for light mode', () => {
      const { axisLineStyle } = useChartTheme()
      expect(axisLineStyle(false).lineStyle.color).toBe('#e5e7eb')
    })
  })
})
