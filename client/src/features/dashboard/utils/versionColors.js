const PALETTE = {
  light: ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316', '#14b8a6', '#6366f1',
          '#a855f7', '#84cc16', '#e11d48', '#0ea5e9', '#d946ef', '#65a30d', '#f43f5e', '#0891b2', '#c026d3', '#4f46e5'],
  dark:  ['#60a5fa', '#4ade80', '#fbbf24', '#f87171', '#a78bfa', '#22d3ee', '#f472b6', '#fb923c', '#2dd4bf', '#818cf8',
          '#c084fc', '#a3e635', '#fb7185', '#38bdf8', '#e879f9', '#84cc16', '#f87171', '#06b6d4', '#d946ef', '#6366f1'],
  unknown: { light: '#9ca3af', dark: '#6b7280' }
}

/**
 * allVersions 배열과 dark 모드 여부로 버전별 색상 맵 생성
 * @param {string[]} allVersions
 * @param {boolean} isDark
 * @returns {Object} { [version]: color }
 */
export function buildVersionColorMap(allVersions, isDark) {
  const palette = isDark ? PALETTE.dark : PALETTE.light
  const unknownColor = isDark ? PALETTE.unknown.dark : PALETTE.unknown.light
  const map = {}
  let colorIdx = 0
  for (const v of allVersions) {
    if (v === 'Unknown') {
      map[v] = unknownColor
    } else {
      map[v] = palette[colorIdx % palette.length]
      colorIdx++
    }
  }
  return map
}
