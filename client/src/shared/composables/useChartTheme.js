import { useTheme } from './useTheme'

/**
 * Shared ECharts theme helpers for dark/light mode.
 *
 * Each function takes a boolean `dark` so that callers (who already
 * read `isDark.value` inside a `computed`) can pass it once and
 * avoid extra `.value` look-ups.
 */
export function useChartTheme() {
  const { isDark } = useTheme()

  /** Tooltip background / border / text */
  function tooltipStyle(dark) {
    return {
      backgroundColor: dark ? '#1f2937' : '#fff',
      borderColor: dark ? '#374151' : '#e5e7eb',
      textStyle: { color: dark ? '#e5e7eb' : '#111827' }
    }
  }

  /** Value-axis label color (muted gray) */
  function axisLabelStyle(dark) {
    return { color: dark ? '#9ca3af' : '#6b7280' }
  }

  /** Category-axis label color (brighter) */
  function categoryAxisLabelStyle(dark) {
    return { color: dark ? '#d1d5db' : '#374151' }
  }

  /** Grid / value-axis split-line */
  function splitLineStyle(dark) {
    return { lineStyle: { color: dark ? '#374151' : '#e5e7eb' } }
  }

  /** Legend text */
  function legendStyle(dark) {
    return { color: dark ? '#9ca3af' : '#6b7280' }
  }

  /** Axis line & tick border color */
  function axisLineStyle(dark) {
    return { lineStyle: { color: dark ? '#374151' : '#e5e7eb' } }
  }

  return {
    isDark,
    tooltipStyle,
    axisLabelStyle,
    categoryAxisLabelStyle,
    splitLineStyle,
    legendStyle,
    axisLineStyle
  }
}
