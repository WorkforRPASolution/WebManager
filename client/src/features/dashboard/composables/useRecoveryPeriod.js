import { ref, computed } from 'vue'

/**
 * 날짜를 YYYY-MM-DD 형식의 로컬 문자열로 변환 (timezone-safe)
 */
export function localDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Recovery 기간 관리 공용 composable
 * @param {Object} options
 * @param {Object} options.periodDays - 기간 프리셋 맵 (e.g., { today: 1, '7d': 7, ... })
 * @param {Function} [options.onShifted] - 기간 이동 후 콜백
 * @param {number} [options.maxDays=730] - 최대 허용 일수
 */
export function useRecoveryPeriod({ periodDays, onShifted, maxDays = 730 } = {}) {
  const selectedPeriod = ref('7d')
  const startDate = ref('')
  const endDate = ref('')

  const isCustom = computed(() => selectedPeriod.value === 'custom')

  /**
   * 프리셋 기간에 따라 시작일/종료일 계산
   */
  function computePresetDates(period) {
    if (period === 'custom') return
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const days = periodDays[period]
    if (!days) return
    const start = new Date(today)
    start.setDate(start.getDate() - days + 1)
    startDate.value = localDateStr(start)
    endDate.value = localDateStr(today)
  }

  /**
   * 기간을 앞뒤로 이동
   */
  function shiftPeriod(direction) {
    const days = periodDays[selectedPeriod.value]
    if (!days) return
    if (!startDate.value || !endDate.value) return

    const s = new Date(startDate.value)
    const e = new Date(endDate.value)
    s.setDate(s.getDate() + direction * days)
    e.setDate(e.getDate() + direction * days)

    // 미래 제한
    const todayDate = new Date()
    todayDate.setHours(0, 0, 0, 0)
    if (direction > 0 && localDateStr(e) > localDateStr(todayDate)) return

    // 과거 제한 (maxDays)
    const limitDate = new Date()
    limitDate.setDate(limitDate.getDate() - maxDays)
    if (direction < 0 && s < limitDate) return

    startDate.value = localDateStr(s)
    endDate.value = localDateStr(e)

    onShifted?.()
  }

  /**
   * 현재 기간이 최신(오늘 포함)인지
   */
  const isLatestPeriod = computed(() => endDate.value >= localDateStr(new Date()))

  return {
    selectedPeriod,
    startDate,
    endDate,
    isCustom,
    isLatestPeriod,
    computePresetDates,
    shiftPeriod
  }
}
