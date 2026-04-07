<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { recoveryApi } from '../../../shared/api'
import { useTheme } from '../../../shared/composables/useTheme'

const props = defineProps({
  days: { type: Number, default: 30 }
})

const emit = defineEmits(['select-date'])

const heatmapData = ref([])
const loading = ref(false)
const fetchError = ref(null)
const selectedDate = ref(null)
const { isDark } = useTheme()

async function fetchData() {
  loading.value = true
  fetchError.value = null
  try {
    const res = await recoveryApi.getBatchHeatmap({ days: props.days })
    heatmapData.value = res.data.data || []
  } catch (err) {
    fetchError.value = err?.response?.data?.error || err?.message || '히트맵 조회 실패'
    heatmapData.value = []
  } finally {
    loading.value = false
  }
}

// 날짜 → 데이터 맵
const dataMap = computed(() => {
  const map = new Map()
  for (const item of heatmapData.value) {
    map.set(item.date, item)
  }
  return map
})

// 히트맵 그리드 생성 (GitHub 스타일: 열=주, 행=요일)
const grid = computed(() => {
  const today = new Date()
  // KST 기준 오늘 날짜
  const kstToday = new Date(today.getTime() + 9 * 60 * 60 * 1000)
  const endDate = new Date(Date.UTC(kstToday.getUTCFullYear(), kstToday.getUTCMonth(), kstToday.getUTCDate()))

  const totalDays = props.days
  const startDate = new Date(endDate.getTime() - (totalDays - 1) * 24 * 60 * 60 * 1000)

  // 주 단위로 그룹화 (0=Mon ~ 6=Sun)
  const weeks = []
  let currentWeek = []
  const cursor = new Date(startDate)

  // 첫 주의 빈 셀 채우기
  const startDow = (cursor.getUTCDay() + 6) % 7 // Mon=0
  for (let i = 0; i < startDow; i++) {
    currentWeek.push(null)
  }

  while (cursor <= endDate) {
    const dateStr = cursor.toISOString().slice(0, 10)
    const isFuture = cursor > endDate
    currentWeek.push({
      date: dateStr,
      data: dataMap.value.get(dateStr) || null,
      isFuture,
      isToday: dateStr === endDate.toISOString().slice(0, 10)
    })

    if (currentWeek.length === 7) {
      weeks.push(currentWeek)
      currentWeek = []
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  // 마지막 주 미래 셀 채우기
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) {
      currentWeek.push({ date: null, data: null, isFuture: true })
    }
    weeks.push(currentWeek)
  }

  return weeks
})

function getCellColor(cell) {
  if (!cell || cell.isFuture || !cell.date) return isDark.value ? 'bg-gray-800' : 'bg-gray-100'
  const d = cell.data
  if (!d) return isDark.value ? 'bg-gray-700' : 'bg-gray-200'

  // 우선순위: fail > skip > backfill > cron
  if (d.fail > 0) return 'bg-red-400 dark:bg-red-600'
  if (d.skip > 0) return 'bg-yellow-300 dark:bg-yellow-600'
  if (d.backfill > 0) return 'bg-blue-400 dark:bg-blue-600'

  // cron 건수에 따른 초록 농도
  const count = d.cron || 0
  if (count === 0) return isDark.value ? 'bg-gray-700' : 'bg-gray-200'
  if (count <= 10) return 'bg-green-200 dark:bg-green-900'
  if (count <= 20) return 'bg-green-300 dark:bg-green-700'
  return 'bg-green-500 dark:bg-green-500'
}

function getTooltip(cell) {
  if (!cell || !cell.date) return ''
  const d = cell.data
  if (!d) return `${cell.date}: 이벤트 없음`
  const parts = [`${cell.date}: 총 ${d.total}건`]
  if (d.cron) parts.push(`cron ${d.cron}`)
  if (d.fail) parts.push(`fail ${d.fail}`)
  if (d.skip) parts.push(`skip ${d.skip}`)
  if (d.backfill) parts.push(`backfill ${d.backfill}`)
  return parts.join(' | ')
}

function handleCellClick(cell) {
  if (!cell || !cell.date || cell.isFuture) return
  selectedDate.value = selectedDate.value === cell.date ? null : cell.date
  emit('select-date', selectedDate.value)
}

watch(() => props.days, fetchData)
onMounted(fetchData)
</script>

<template>
  <div>
    <!-- Loading -->
    <div v-if="loading" class="flex justify-center py-4">
      <svg class="animate-spin h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>
    </div>

    <!-- Error -->
    <div v-else-if="fetchError" class="flex items-center justify-between gap-2 py-3 px-3 rounded text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
      <span>히트맵 로드 실패: {{ fetchError }}</span>
      <button
        type="button"
        class="px-2 py-0.5 rounded border border-red-300 dark:border-red-700 hover:bg-red-100 dark:hover:bg-red-900/40"
        @click="fetchData"
      >다시 시도</button>
    </div>

    <div v-else>
      <!-- Grid -->
      <div class="flex gap-0.5">
        <!-- 요일 라벨 -->
        <div class="flex flex-col gap-0.5 mr-1 justify-center">
          <div class="h-3.5 text-[9px] text-gray-400 flex items-center">Mon</div>
          <div class="h-3.5" />
          <div class="h-3.5 text-[9px] text-gray-400 flex items-center">Wed</div>
          <div class="h-3.5" />
          <div class="h-3.5 text-[9px] text-gray-400 flex items-center">Fri</div>
          <div class="h-3.5" />
          <div class="h-3.5 text-[9px] text-gray-400 flex items-center">Sun</div>
        </div>

        <!-- 주 컬럼 -->
        <div v-for="(week, wi) in grid" :key="wi" class="flex flex-col gap-0.5">
          <div
            v-for="(cell, di) in week"
            :key="di"
            :class="[
              'w-3.5 h-3.5 rounded-sm cursor-pointer transition-all',
              getCellColor(cell),
              cell && selectedDate === cell.date ? 'ring-2 ring-blue-500' : '',
              cell && !cell.isFuture ? 'hover:ring-1 hover:ring-gray-400' : 'opacity-20 cursor-default'
            ]"
            :title="getTooltip(cell)"
            @click="handleCellClick(cell)"
          />
        </div>
      </div>

      <!-- 범례 -->
      <div class="flex items-center gap-3 mt-2 text-[11px] text-gray-500 dark:text-gray-400">
        <span>적음</span>
        <div class="flex gap-0.5">
          <div class="w-2.5 h-2.5 rounded-sm bg-green-200 dark:bg-green-900" />
          <div class="w-2.5 h-2.5 rounded-sm bg-green-300 dark:bg-green-700" />
          <div class="w-2.5 h-2.5 rounded-sm bg-green-500" />
        </div>
        <span>많음</span>
        <span class="mx-1">|</span>
        <div class="flex items-center gap-1"><div class="w-2.5 h-2.5 rounded-sm bg-red-400 dark:bg-red-600" />fail</div>
        <div class="flex items-center gap-1"><div class="w-2.5 h-2.5 rounded-sm bg-yellow-300 dark:bg-yellow-600" />skip</div>
        <div class="flex items-center gap-1"><div class="w-2.5 h-2.5 rounded-sm bg-blue-400 dark:bg-blue-600" />backfill</div>
      </div>

      <p class="text-[11px] text-gray-400 mt-1">셀을 클릭하면 해당 날짜로 필터링됩니다</p>
    </div>
  </div>
</template>
