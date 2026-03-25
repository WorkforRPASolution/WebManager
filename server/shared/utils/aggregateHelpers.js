/**
 * Aggregate Helpers
 *
 * MongoDB aggregate 기반 유틸리티.
 * distinct() 대체: 값 목록 + 문서 카운트를 한 쿼리로 반환.
 */

/**
 * distinct + count를 한 aggregate 쿼리로 수행
 *
 * @param {import('mongoose').Model} Model - Mongoose 모델
 * @param {string} field - 그룹핑할 필드명
 * @param {Object} [query={}] - $match 조건 (기존 distinct()의 filter와 동일)
 * @returns {Promise<Array<{value: string, count: number}>>} 값+카운트 배열 (value 오름차순)
 */
async function distinctWithCount(Model, field, query = {}) {
  const matchStage = { ...query }

  // 대상 필드에 기존 필터가 없으면 null/빈 문자열 제외
  if (matchStage[field] === undefined) {
    matchStage[field] = { $nin: [null, ''] }
  }

  const pipeline = [
    { $match: matchStage },
    { $group: { _id: `$${field}`, count: { $sum: 1 } } },
    { $project: { _id: 0, value: '$_id', count: 1 } },
    { $sort: { value: 1 } }
  ]

  return Model.aggregate(pipeline)
}

module.exports = { distinctWithCount }
