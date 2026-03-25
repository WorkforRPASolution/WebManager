/**
 * ECharts xAxis 라벨을 granularity에 맞게 축약
 * @param {string} val - 원본 라벨 ("2026-03-25", "2026-03-25 14:00" 등)
 * @param {object} opts
 * @param {boolean} opts.isHourly - 시간별 granularity
 * @param {boolean} opts.isWeekly - 주별 granularity
 * @returns {string} 축약된 라벨
 */
export function formatChartTimeLabel(val, { isHourly, isWeekly } = {}) {
  if (isWeekly && val.length === 10) return val.slice(5) + '~'
  if (!isHourly && val.length === 10) return val.slice(5)
  if (isHourly && val.length > 10) return val.slice(11, 16)
  return val
}
