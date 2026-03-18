/**
 * Bucket 라벨 포맷 유틸리티
 *
 * bucket은 "시작 시각"을 저장하지만, 차트에는 "~까지"로 표시한다.
 * 모든 granularity에서 통일된 의미: 해당 라벨 시점까지의 데이터.
 *
 * 예: hourly  bucket 10:00      → "11:00"     (10:00~11:00 데이터)
 *     daily   bucket 3/17       → "03/18"     (3/17~3/18 데이터)
 *     weekly  bucket 3/10(월)   → "~03/17"    (3/10~3/16 데이터, 3/17 자정까지)
 *     monthly bucket 2026.03    → "~2026.04"  (3월 데이터, 4월 시작 전까지)
 */

/**
 * bucket 시작 시각에 granularity 한 단위를 더한 종료 시각 계산
 */
function computeEndDate(bucket, granularity) {
  const start = new Date(bucket)

  switch (granularity) {
    case 'hourly':
      return new Date(start.getTime() + 60 * 60 * 1000)
    case 'daily':
      return new Date(start.getTime() + 24 * 60 * 60 * 1000)
    case 'weekly':
      return new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000)
    case 'monthly': {
      const end = new Date(start)
      end.setMonth(end.getMonth() + 1)
      return end
    }
    default:
      return new Date(start.getTime() + 24 * 60 * 60 * 1000)
  }
}

/**
 * bucket 시작 시각을 "~까지" 라벨로 변환
 * @param {string|Date} bucket - bucket 시작 시각
 * @param {string} granularity - hourly|daily|weekly|monthly
 * @returns {string} 포맷된 라벨
 */
export function formatBucketLabel(bucket, granularity) {
  const date = computeEndDate(bucket, granularity)
  const pad = (n) => String(n).padStart(2, '0')
  const mm = pad(date.getMonth() + 1)
  const dd = pad(date.getDate())

  switch (granularity) {
    case 'hourly': {
      const today = new Date()
      if (date.toDateString() !== today.toDateString()) return `${mm}/${dd} ${pad(date.getHours())}:00`
      return `${pad(date.getHours())}:00`
    }
    case 'daily':
      return `${mm}/${dd}`
    case 'weekly':
      return `~${mm}/${dd}`
    case 'monthly':
      return `~${date.getFullYear()}.${mm}`
    default:
      return `${mm}/${dd}`
  }
}
