/**
 * 콤마로 구분된 문자열을 배열로 파싱 (trim + 빈 문자열 필터)
 * @param {string|null|undefined} value
 * @returns {string[]|null}
 */
function parseCommaSeparated(value) {
  if (!value) return null
  const result = value.split(',').map(s => s.trim()).filter(s => s)
  return result.length > 0 ? result : null
}

module.exports = { parseCommaSeparated }
