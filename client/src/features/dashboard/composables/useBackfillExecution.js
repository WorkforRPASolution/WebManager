import { ref, computed } from 'vue'
import { recoveryApi } from '../../../shared/api'

/**
 * Backfill 실행/상태 관리 composable
 * @param {Object} options
 * @param {Function} options.getFormValues - () => { startDate, endDate, skipHourly, skipDaily, throttleMs, retryPartial }
 * @param {Function} options.showError - toast error callback
 */
export function useBackfillExecution({ getFormValues, showError }) {
  // ── Analysis ──
  const analyzing = ref(false)
  const analysisResult = ref(null)

  // ── Server State ──
  const serverState = ref({
    status: 'idle', current: 0, total: 0, skipped: 0,
    period: null, currentBucket: null, startedAt: null, completedAt: null, errors: []
  })
  const serverStatus = computed(() => serverState.value.status)

  // ── UI State ──
  const logs = ref([])
  const indexWarning = ref(false)
  let pollTimer = null
  let pollFailCount = 0
  let lastBucket = null

  // ── Distribution ──
  const distributionLoading = ref(false)
  const distributionData = ref(null)

  // ── Computed ──
  const totalActionable = computed(() => {
    if (!analysisResult.value) return 0
    let total = 0
    if (analysisResult.value.hourly) total += analysisResult.value.hourly.actionable
    if (analysisResult.value.daily) total += analysisResult.value.daily.actionable
    return total
  })

  const progressPercent = computed(() => {
    const s = serverState.value
    if (s.total <= 0) return 0
    return Math.round((s.current / s.total) * 100)
  })

  const elapsed = computed(() => formatElapsed(serverState.value.startedAt))

  const eta = computed(() => {
    const s = serverState.value
    if (!s.startedAt || s.current <= s.skipped) return ''
    const elapsedMs = Date.now() - new Date(s.startedAt).getTime()
    const processed = s.current - s.skipped
    if (processed <= 0) return ''
    const remaining = s.total - s.current
    const etaMs = (elapsedMs / processed) * remaining
    return formatDuration(etaMs / 60000)
  })

  const statusLabel = computed(() => {
    const map = {
      idle: '대기', running: '실행 중', completed: '완료',
      completed_with_warnings: '완료 (경고)', cancelled: '취소됨', error: '오류'
    }
    return map[serverStatus.value] || serverStatus.value
  })

  const statusBadgeClass = computed(() => {
    const base = 'px-2 py-0.5 text-xs font-medium rounded-full'
    const map = {
      idle: `${base} bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400`,
      running: `${base} bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400`,
      completed: `${base} bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400`,
      completed_with_warnings: `${base} bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400`,
      cancelled: `${base} bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400`,
      error: `${base} bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400`
    }
    return map[serverStatus.value] || map.idle
  })

  // ── Actions ──
  async function handleAnalyze() {
    analyzing.value = true
    analysisResult.value = null
    try {
      const res = await recoveryApi.analyzeBackfill(getFormValues())
      analysisResult.value = res.data
      indexWarning.value = false
    } catch (err) {
      if (err.response?.data?.indexReady === false) {
        indexWarning.value = true
      }
      showError(err.response?.data?.error || '분석 실패')
    } finally {
      analyzing.value = false
    }
  }

  async function handleStart() {
    logs.value = []
    lastBucket = null
    try {
      await recoveryApi.startBackfill(getFormValues())
      startPolling()
    } catch (err) {
      if (err.response?.status === 409) {
        showError('이미 실행 중입니다')
        startPolling()
      } else {
        showError(err.response?.data?.error || 'Backfill 시작 실패')
      }
    }
  }

  async function handleCancel() {
    try {
      await recoveryApi.cancelBackfill()
    } catch {
      showError('취소 요청 실패')
    }
  }

  // ── Polling ──
  function startPolling() {
    stopPolling()
    pollFailCount = 0
    fetchStatus()
    pollTimer = setInterval(fetchStatus, 3000)
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  async function fetchStatus() {
    try {
      const res = await recoveryApi.getBackfillStatus()
      serverState.value = res.data
      if (res.data.indexReady === false) indexWarning.value = true
      pollFailCount = 0

      const currentBucket = res.data.currentBucket
      if (currentBucket && currentBucket !== lastBucket) {
        const time = new Date().toLocaleTimeString('ko-KR', { hour12: false })
        const symbol = res.data.status === 'error' ? '✗' : '✓'
        logs.value.push(`[${time}] ${res.data.period} ${formatBucket(currentBucket)} ${symbol}`)
        if (logs.value.length > 100) logs.value.shift()
        lastBucket = currentBucket
      }

      if (['completed', 'completed_with_warnings', 'cancelled', 'error', 'idle'].includes(res.data.status)) {
        stopPolling()
      }
    } catch {
      pollFailCount++
      if (pollFailCount >= 3) {
        stopPolling()
        showError('상태 조회 실패. 재시도하려면 분석을 다시 실행하세요.')
      }
    }
  }

  async function fetchDistribution(period) {
    distributionLoading.value = true
    try {
      const res = await recoveryApi.getCronRunDistribution({ period })
      distributionData.value = res.data
    } catch {
      distributionData.value = null
    } finally {
      distributionLoading.value = false
    }
  }

  // ── Formatting ──
  function pct(value, total) {
    if (!total) return '0%'
    return `${((value / total) * 100).toFixed(1)}%`
  }

  function formatBucket(bucket) {
    if (!bucket) return ''
    const d = new Date(bucket)
    return d.toISOString().replace('T', ' ').slice(0, 16)
  }

  function formatDuration(minutes) {
    if (!minutes || minutes <= 0) return '0분'
    if (minutes < 60) return `${Math.round(minutes)}분`
    const h = Math.floor(minutes / 60)
    const m = Math.round(minutes % 60)
    return m > 0 ? `${h}시간 ${m}분` : `${h}시간`
  }

  function formatElapsed(startedAt) {
    if (!startedAt) return ''
    const elapsed = Date.now() - new Date(startedAt).getTime()
    const sec = Math.floor(elapsed / 1000)
    const min = Math.floor(sec / 60)
    const remSec = sec % 60
    if (min >= 60) {
      const h = Math.floor(min / 60)
      const remMin = min % 60
      return `${h}시간 ${remMin}분 ${remSec}초`
    }
    return `${min}분 ${remSec}초`
  }

  function formatDistributionLabel(bucket, granularity) {
    const d = new Date(bucket)
    const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000)
    const mm = String(kst.getUTCMonth() + 1).padStart(2, '0')
    const dd = String(kst.getUTCDate()).padStart(2, '0')
    if (granularity === 'hourly') {
      const hh = String(kst.getUTCHours()).padStart(2, '0')
      return `${mm}/${dd} ${hh}:00`
    }
    if (granularity === 'weekly') {
      return `${mm}/${dd}~`
    }
    return `${mm}/${dd}`
  }

  return {
    // State
    analyzing, analysisResult, serverState, serverStatus,
    logs, indexWarning,
    distributionLoading, distributionData,
    // Computed
    totalActionable, progressPercent, elapsed, eta,
    statusLabel, statusBadgeClass,
    // Actions
    handleAnalyze, handleStart, handleCancel,
    startPolling, stopPolling, fetchStatus, fetchDistribution,
    // Formatting
    pct, formatBucket, formatDuration, formatDistributionLabel
  }
}
