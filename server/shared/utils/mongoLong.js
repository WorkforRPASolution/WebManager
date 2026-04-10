/**
 * MongoDB NumberLong (BSON int64) 유틸리티
 *
 * EARS DB는 Akka 서버와 공유하며, Akka는 정수 필드를 NumberLong(int64)으로 저장합니다.
 * Mongoose의 type: Number는 JavaScript double로 저장하므로, 같은 컬렉션 내 타입 불일치가 발생합니다.
 * 이 유틸리티를 통해 쓰기 전 NumberLong으로 변환하여 타입 일관성을 유지합니다.
 *
 * 읽기 시에는 MongoDB 드라이버의 promoteLongs: true (기본값)가
 * NumberLong → JavaScript Number로 자동 변환하므로 추가 처리 불필요.
 */

const { Long } = require('bson')

/**
 * 값을 BSON Long (int64)으로 변환
 * @param {*} value - 변환할 값
 * @returns {Long|null|undefined} - BSON Long 또는 null/undefined
 */
function toLong(value) {
  if (value == null) return value
  if (value instanceof Long) return value
  return Long.fromNumber(Number(value))
}

/**
 * 객체의 지정된 필드를 BSON Long으로 변환 (shallow copy)
 * dot-notation 지원 (예: 'agentPorts.rpc')
 *
 * @param {Object} data - 원본 데이터 (변경하지 않음)
 * @param {string[]} fields - Long으로 변환할 필드 목록
 * @returns {Object} - 변환된 새 객체
 */
function ensureLongFields(data, fields) {
  const result = { ...data }

  // 중첩 필드를 부모별로 그룹핑 (동일 부모 1회만 복사)
  const nested = {}
  for (const field of fields) {
    const dot = field.indexOf('.')
    if (dot === -1) {
      // flat field
      if (result[field] != null) {
        result[field] = toLong(result[field])
      }
    } else {
      const parent = field.slice(0, dot)
      const child = field.slice(dot + 1)
      if (!nested[parent]) nested[parent] = []
      nested[parent].push(child)
    }
  }

  // 중첩 필드 일괄 변환
  for (const [parent, children] of Object.entries(nested)) {
    if (result[parent] == null) continue
    const copy = { ...result[parent] }
    for (const child of children) {
      if (copy[child] != null) {
        copy[child] = toLong(copy[child])
      }
    }
    result[parent] = copy
  }

  return result
}

/**
 * plain object 여부 판별 (Long, Date, Array 제외)
 */
function isPlainObject(value) {
  return typeof value === 'object' && value !== null
    && !Array.isArray(value) && !(value instanceof Date) && !(value instanceof Long)
}

/**
 * null/undefined 필드를 제거한 새 객체 반환 (CREATE용)
 * 중첩 객체의 null 서브필드도 제거하며, 결과가 빈 객체이면 부모도 제거.
 *
 * @param {Object} data - 원본 데이터 (변경하지 않음)
 * @returns {Object} - null 필드가 제거된 새 객체
 */
function stripNullFields(data) {
  const result = {}
  for (const [key, value] of Object.entries(data)) {
    if (value == null) continue
    if (isPlainObject(value)) {
      const nested = stripNullFields(value)
      if (Object.keys(nested).length > 0) {
        result[key] = nested
      }
    } else {
      result[key] = value
    }
  }
  return result
}

/**
 * null/undefined 필드를 $set과 $unset으로 분리 (UPDATE용)
 * - 값이 있는 필드 → $set
 * - null/undefined 필드 → $unset
 * - 중첩 객체: null 서브필드를 제거한 결과를 $set, 전체 null이면 $unset
 *
 * @param {Object} data - 원본 데이터 (변경하지 않음)
 * @returns {{ $set: Object, $unset: Object }}
 */
function separateNullFields(data) {
  const $set = {}
  const $unset = {}

  for (const [key, value] of Object.entries(data)) {
    if (value == null) {
      $unset[key] = ''
    } else if (isPlainObject(value)) {
      const stripped = stripNullFields(value)
      if (Object.keys(stripped).length > 0) {
        $set[key] = stripped
      } else {
        $unset[key] = ''
      }
    } else {
      $set[key] = value
    }
  }

  return { $set, $unset }
}

module.exports = { toLong, ensureLongFields, stripNullFields, separateNullFields }
