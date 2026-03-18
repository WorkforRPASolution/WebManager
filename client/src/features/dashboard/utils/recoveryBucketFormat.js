/**
 * Bucket 라벨 포맷 유틸리티
 *
 * bucket은 "시작 시각"을 저장하지만, 차트에는 "~까지"로 표시한다.
 * 예: hourly bucket 10:00 → "11:00" (10:00~11:00 데이터)
 *     daily bucket 3/17  → "03/18" (3/17 00:00~3/18 00:00 데이터)
 */

const OFFSET = {
  hourly: 60 * 60 * 1000,       // +1시간
  daily: 24 * 60 * 60 * 1000,   // +1일
  weekly: 0,                     // weekly는 시작일 표시
  monthly: 0                     // monthly는 연/월 표시
}

/**
 * bucket 시작 시각을 "~까지" 라벨로 변환
 * @param {string|Date} bucket - bucket 시작 시각
 * @param {string} granularity - hourly|daily|weekly|monthly
 * @returns {string} 포맷된 라벨
 */
export function formatBucketLabel(bucket, granularity) {
  const offset = OFFSET[granularity] || 0
  const date = new Date(new Date(bucket).getTime() + offset)
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
      return `${mm}/${dd}~`
    case 'monthly':
      return `${date.getFullYear()}.${mm}`
    default:
      return `${mm}/${dd}`
  }
}
