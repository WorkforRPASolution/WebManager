/**
 * 깊은 객체 병합 (배열은 대체, 중첩 객체는 재귀 병합)
 * target을 변경하지 않고 새 객체를 반환
 * @param {object} target
 * @param {object} source
 * @returns {object}
 */
function deepMerge(target, source) {
  const result = { ...target }
  for (const key in source) {
    if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key]) &&
        typeof result[key] === 'object' && result[key] !== null && !Array.isArray(result[key])) {
      result[key] = deepMerge(result[key], source[key])
    } else {
      result[key] = JSON.parse(JSON.stringify(source[key]))
    }
  }
  return result
}

module.exports = { deepMerge }
