<script setup>
import { ref, computed, onMounted } from 'vue'
import { userActivityApi } from '../../../shared/api'
import { useToast } from '../../../shared/composables/useToast'
import UserActivityFilterBar from './UserActivityFilterBar.vue'
import WebManagerKPICards from './WebManagerKPICards.vue'
import WebManagerPageChart from './WebManagerPageChart.vue'
import WebManagerPageDonut from './WebManagerPageDonut.vue'
import WebManagerConcurrentChart from './WebManagerConcurrentChart.vue'
import WebManagerDurationTrendChart from './WebManagerDurationTrendChart.vue'
import WebManagerProcessTrendChart from './WebManagerProcessTrendChart.vue'
import WebManagerProcessDonut from './WebManagerProcessDonut.vue'
import WebManagerHourlyHeatmap from './WebManagerHourlyHeatmap.vue'
import WebManagerGroupTrendChart from './WebManagerGroupTrendChart.vue'
import WebManagerTopUsersChart from './WebManagerTopUsersChart.vue'
import WebManagerRecentTable from './WebManagerRecentTable.vue'
import {
  exportWebManagerPageSummaryCsv,
  exportWebManagerProcessTrendCsv,
  exportWebManagerTopUsersCsv,
  exportWebManagerRecentVisitsCsv
} from '../utils/csvExport'

const { showError } = useToast()

const loading = ref(false)
const data = ref(null)
const currentFilters = ref({ period: '7d' })

// Toggle state
const includeAdmin = ref(false)
const recentMode = ref('detail') // 'detail' | 'user'

// WebManager 전용 기간 옵션 (access log TTL = 90일)
const wmPeriodOptions = [
  { value: 'today', label: '최근 24시간' },
  { value: '7d', label: '최근 7일' },
  { value: '30d', label: '최근 30일' },
  { value: 'all', label: '최근 90일' },
  { value: 'custom', label: '시작일 지정' }
]

const GRANULARITY_LABELS = { hourly: '시간별', daily: '일별', weekly: '주별' }
const granularityLabel = computed(() => GRANULARITY_LABELS[data.value?.granularity] || '일별')

async function fetchData(filters = { period: '7d' }) {
  loading.value = true
  currentFilters.value = filters
  try {
    const queryFilters = { ...filters }
    if (includeAdmin.value) {
      queryFilters.includeAdmin = 'true'
    }
    if (recentMode.value === 'user') {
      queryFilters.recentMode = 'user'
    }
    const res = await userActivityApi.getWebManagerStats(queryFilters)
    data.value = res.data
  } catch (err) {
    showError('데이터 로드에 실패했습니다')
  } finally {
    loading.value = false
  }
}

function handleSearch(filters) {
  fetchData(filters)
}

function toggleIncludeAdmin() {
  includeAdmin.value = !includeAdmin.value
  fetchData(currentFilters.value)
}

function setRecentMode(mode) {
  if (recentMode.value === mode) return
  recentMode.value = mode
  fetchData(currentFilters.value)
}

async function handleExportPageCsv() {
  exportWebManagerPageSummaryCsv(data.value?.pageSummary || [])
}

async function handleExportProcessTrendCsv() {
  exportWebManagerProcessTrendCsv(data.value?.processTrend || [])
}

async function handleExportTopUsersCsv() {
  exportWebManagerTopUsersCsv(data.value?.topUsers || [])
}

async function handleExportRecentCsv() {
  try {
    const queryFilters = { ...currentFilters.value, noLimit: 'true' }
    if (includeAdmin.value) queryFilters.includeAdmin = 'true'
    if (recentMode.value === 'user') queryFilters.recentMode = 'user'
    const res = await userActivityApi.getWebManagerStats(queryFilters)
    exportWebManagerRecentVisitsCsv(res.data.recentVisits || [])
  } catch (err) {
    showError('CSV 내보내기에 실패했습니다')
  }
}

onMounted(() => {
  fetchData()
})
</script>

<template>
  <div class="p-6 space-y-6">
    <!-- Filter Bar + Toggles -->
    <div class="flex flex-wrap items-end gap-3">
      <UserActivityFilterBar
        :loading="loading"
        :hide-process="true"
        :period-options="wmPeriodOptions"
        default-period="7d"
        :max-days="90"
        @search="handleSearch"
      />
      <div class="flex items-center gap-3 ml-auto">
        <button
          @click="toggleIncludeAdmin"
          class="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-colors"
          :class="includeAdmin
            ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300'
            : 'bg-white dark:bg-dark-card border-gray-300 dark:border-dark-border text-gray-500 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500'"
        >
          <span class="w-3 h-3 rounded-sm border flex items-center justify-center"
            :class="includeAdmin ? 'bg-blue-600 border-blue-600' : 'border-gray-400 dark:border-gray-500'">
            <svg v-if="includeAdmin" class="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
          </span>
          관리자 포함
        </button>
      </div>
    </div>

    <!-- Loading Skeleton -->
    <div v-if="loading && !data" class="space-y-6">
      <div class="flex flex-wrap gap-4">
        <div v-for="i in 4" :key="i" class="flex-1 min-w-[160px] bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border p-4 animate-pulse">
          <div class="h-3 bg-gray-200 dark:bg-gray-700 rounded w-20 mb-2"></div>
          <div class="h-7 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
        </div>
      </div>
    </div>

    <!-- Data Content -->
    <template v-if="data">
      <!-- KPI Cards -->
      <WebManagerKPICards :kpi="data.kpi" :concurrent="data.concurrent" />

      <!-- 일별 방문 현황 (2/3) + 페이지별 방문 비율 (1/3) — Recovery Overview 스타일 -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="lg:col-span-2 bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border p-4">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-sm font-semibold text-gray-600 dark:text-gray-300">
              {{ granularityLabel }} 방문 현황
            </h3>
            <button v-if="(data.pageSummary || []).length > 0" @click="handleExportPageCsv" class="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-border transition-colors">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              CSV
            </button>
          </div>
          <WebManagerPageChart :data="data.pageTrend || []" :page-summary="data.pageSummary || []" :granularity="data.granularity || 'daily'" />
        </div>
        <div class="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border p-4">
          <h3 class="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-3">
            페이지별 방문 비율
          </h3>
          <WebManagerPageDonut :data="data.pageSummary || []" />
        </div>
      </div>

      <!-- 공정별 활성 사용자 추이 (2/3) + 공정별 도넛 (1/3) -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="lg:col-span-2 bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border p-4">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-sm font-semibold text-gray-600 dark:text-gray-300">
              공정별 활성 사용자 추이
              <span class="ml-1.5 text-xs font-normal text-gray-400 dark:text-gray-500">다중 공정 중복 포함</span>
            </h3>
            <button v-if="(data.processTrend || []).length > 0" @click="handleExportProcessTrendCsv" class="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-border transition-colors">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              CSV
            </button>
          </div>
          <WebManagerProcessTrendChart :data="data.processTrend || []" :granularity="data.granularity || 'daily'" />
        </div>
        <div class="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border p-4">
          <h3 class="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-3">
            공정별 활성 사용자 현황
          </h3>
          <WebManagerProcessDonut :data="data.processActiveUsers || []" />
        </div>
      </div>

      <!-- 동시접속 추이 (1/2) + 페이지별 평균 체류시간 추이 (1/2) -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border p-4">
          <h3 class="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-3">
            동시접속 추이
          </h3>
          <WebManagerConcurrentChart
            :data="(data.concurrent || {}).trend || []"
            :granularity="data.granularity || 'daily'"
            :peak="(data.concurrent || {}).peak || 0"
          />
        </div>
        <div class="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border p-4">
          <h3 class="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-3">
            페이지별 평균 체류시간 추이
          </h3>
          <WebManagerDurationTrendChart
            :data="data.durationTrend || []"
            :page-summary="data.pageSummary || []"
            :granularity="data.granularity || 'daily'"
          />
        </div>
      </div>

      <!-- Hourly Heatmap (1/2) + Menu Group Stacked Area (1/2) -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border p-4">
          <h3 class="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-3">
            시간대별 사용 패턴
          </h3>
          <WebManagerHourlyHeatmap :data="data.hourlyHeatmap || []" />
        </div>
        <div class="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border p-4">
          <h3 class="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-3">
            메뉴 그룹별 방문 추이
          </h3>
          <WebManagerGroupTrendChart :data="data.groupTrend || []" :granularity="data.granularity || 'daily'" />
        </div>
      </div>

      <!-- Top 10 + Recent Visits (side by side) -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border p-4">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Top 10 활성 사용자
              <span class="ml-1.5 text-xs font-normal text-gray-400 dark:text-gray-500">방문 횟수 기준</span>
            </h3>
            <button v-if="(data.topUsers || []).length > 0" @click="handleExportTopUsersCsv" class="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-border transition-colors">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              CSV
            </button>
          </div>
          <WebManagerTopUsersChart :data="data.topUsers || []" />
        </div>

        <div class="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border p-4">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-3">
              <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">
                최근 접속 이력
                <span class="ml-1.5 text-xs font-normal text-gray-400 dark:text-gray-500">접속 시간 역순</span>
              </h3>
              <div class="flex rounded-lg border border-gray-300 dark:border-dark-border overflow-hidden">
                <button
                  @click="setRecentMode('detail')"
                  class="px-2.5 py-1 text-xs font-medium transition-colors"
                  :class="recentMode === 'detail'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-dark-card text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-dark-border'"
                >상세</button>
                <button
                  @click="setRecentMode('user')"
                  class="px-2.5 py-1 text-xs font-medium transition-colors border-l border-gray-300 dark:border-dark-border"
                  :class="recentMode === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-dark-card text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-dark-border'"
                >사용자별</button>
              </div>
            </div>
            <button v-if="(data.recentVisits || []).length > 0" @click="handleExportRecentCsv" class="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-border transition-colors">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              CSV
            </button>
          </div>
          <WebManagerRecentTable :data="data.recentVisits || []" />
        </div>
      </div>
    </template>
  </div>
</template>
