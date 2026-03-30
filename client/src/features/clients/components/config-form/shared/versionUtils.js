/**
 * ARSAgent 버전 비교 유틸리티
 *
 * Agent 버전 문자열 (X.X.X.X) 비교 및 신규 log_type 지원 여부 판별
 */

/**
 * Compare two version strings in 'X.X.X.X' format.
 * @param {string} a - version A
 * @param {string} b - version B
 * @returns {number} -1 (a < b), 0 (equal), 1 (a > b)
 */
export function compareVersions(a, b) {
  const pa = (a || '').split('.').map(Number)
  const pb = (b || '').split('.').map(Number)
  const len = Math.max(pa.length, pb.length)
  for (let i = 0; i < len; i++) {
    const va = pa[i] || 0
    const vb = pb[i] || 0
    if (va < vb) return -1
    if (va > vb) return 1
  }
  return 0
}

const NEW_LOG_TYPE_THRESHOLD = import.meta.env.VITE_NEW_LOG_TYPE_THRESHOLD || '20.0.0.0'

/**
 * Check if the given version supports new canonical log_type names.
 * Returns false for null/undefined (unknown version → old names for safety).
 * @param {string|null|undefined} version
 * @returns {boolean}
 */
export function isNewLogTypeVersion(version) {
  if (!version) return false
  return compareVersions(version, NEW_LOG_TYPE_THRESHOLD) >= 0
}
