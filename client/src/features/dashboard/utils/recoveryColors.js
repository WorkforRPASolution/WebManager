/**
 * Recovery Dashboard 색상 매핑
 * Status/Trigger → light/dark mode 색상
 */

// Status → color mapping
export const STATUS_COLORS = {
  Success: { light: '#22c55e', dark: '#4ade80' },
  Failed: { light: '#ef4444', dark: '#f87171' },
  Stopped: { light: '#f59e0b', dark: '#f97316' },
  ScriptFailed: { light: '#e11d48', dark: '#fb7185' },
  VisionDelayed: { light: '#8b5cf6', dark: '#a78bfa' },
  NotStarted: { light: '#6b7280', dark: '#9ca3af' },
  Skip: { light: '#06b6d4', dark: '#22d3ee' },
  Wait: { light: '#d1d5db', dark: '#4b5563' },
  StartPending: { light: '#a3a3a3', dark: '#737373' },
  Retry: { light: '#f97316', dark: '#fb923c' },
  Unknown: { light: '#9ca3af', dark: '#6b7280' }
}

// Trigger → color mapping
export const TRIGGER_COLORS = {
  Log: { light: '#3b82f6', dark: '#60a5fa' },
  Scheduler: { light: '#8b5cf6', dark: '#a78bfa' },
  Status: { light: '#f59e0b', dark: '#fbbf24' },
  SE: { light: '#10b981', dark: '#34d399' },
  Scenario: { light: '#ec4899', dark: '#f472b6' },
  Unknown: { light: '#6b7280', dark: '#9ca3af' },
  Other: { light: '#a3a3a3', dark: '#737373' }
}

/**
 * Status에 해당하는 색상 반환
 * @param {string} status - 상태 문자열
 * @param {boolean} isDark - 다크 모드 여부
 * @returns {string} hex color
 */
export function getStatusColor(status, isDark) {
  const mode = isDark ? 'dark' : 'light'
  return STATUS_COLORS[status]?.[mode] || STATUS_COLORS.Unknown[mode]
}

/**
 * Trigger에 해당하는 색상 반환
 * @param {string} trigger - 트리거 문자열
 * @param {boolean} isDark - 다크 모드 여부
 * @returns {string} hex color
 */
/**
 * 차트에 표시할 주요 Status 목록 반환
 * @returns {string[]}
 */
export function getStatusList() {
  return Object.keys(STATUS_COLORS)
}

export function getTriggerColor(trigger, isDark) {
  const mode = isDark ? 'dark' : 'light'
  return TRIGGER_COLORS[trigger]?.[mode] || TRIGGER_COLORS.Other[mode]
}

// Category 색상 팔레트 (인덱스 기반, STATUS/TRIGGER와 비충돌)
const CATEGORY_PALETTE = [
  { light: '#3b82f6', dark: '#60a5fa' },   // blue
  { light: '#8b5cf6', dark: '#a78bfa' },   // violet
  { light: '#10b981', dark: '#34d399' },   // emerald
  { light: '#f59e0b', dark: '#fbbf24' },   // amber
  { light: '#ec4899', dark: '#f472b6' },   // pink
  { light: '#14b8a6', dark: '#2dd4bf' },   // teal
  { light: '#d97706', dark: '#f97316' },   // orange
  { light: '#6366f1', dark: '#818cf8' },   // indigo
  { light: '#e11d48', dark: '#fb7185' },   // rose
  { light: '#0891b2', dark: '#22d3ee' },   // cyan
  { light: '#65a30d', dark: '#a3e635' },   // lime
  { light: '#7c3aed', dark: '#c084fc' }    // purple
]

/**
 * 카테고리 인덱스에 해당하는 색상 반환
 * @param {number} index - 카테고리 순번 (0-based)
 * @param {boolean} isDark - 다크 모드 여부
 * @returns {string} hex color
 */
export function getCategoryColor(index, isDark) {
  const mode = isDark ? 'dark' : 'light'
  const palette = CATEGORY_PALETTE[index % CATEGORY_PALETTE.length]
  return palette[mode]
}
