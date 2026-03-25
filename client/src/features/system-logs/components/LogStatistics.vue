<script setup>
import { ref, computed, onMounted } from 'vue'
import LogKPICards from './LogKPICards.vue'
import LogTrendChart from './LogTrendChart.vue'
import LogCategoryDonut from './LogCategoryDonut.vue'
import LogTopErrors from './LogTopErrors.vue'
import LogSecurityChart from './LogSecurityChart.vue'
import LogAuthBreakdownChart from './LogAuthBreakdownChart.vue'
import LogBatchHealthChart from './LogBatchHealthChart.vue'
import LogTopUsersChart from './LogTopUsersChart.vue'
import LogRecentAuditsTable from './LogRecentAuditsTable.vue'
import UserActivityFilterBar from '../../dashboard/components/UserActivityFilterBar.vue'
import { systemLogsApi } from '@/shared/api'

const loading = ref(false)
const stats = ref(null)

const statsPeriodOptions = [
  { value: 'today', label: '최근 24시간' },
  { value: '7d', label: '최근 7일' },
  { value: '30d', label: '최근 30일' },
  { value: '90d', label: '최근 90일' },
  { value: 'custom', label: '기간 지정' }
]

const PERIOD_LABELS = {
  today: '최근 24시간',
  '7d': '최근 7일',
  '30d': '최근 30일',
  '90d': '최근 90일',
  custom: '선택 기간'
}

const currentPeriodLabel = ref('최근 7일')

const GRAN_LABELS = {
  hourly: '시간별',
  daily: '일별',
  weekly: '주별'
}

const trendTitle = computed(() => {
  const gran = stats.value?.granularity
  return `Category Trend (${GRAN_LABELS[gran] || '일별'})`
})

async function fetchStats(params = {}) {
  loading.value = true
  try {
    const period = params.period || '7d'
    const query = { period }
    if (period === 'custom') {
      if (params.startDate) query.startDate = params.startDate + 'T00:00:00.000Z'
      if (params.endDate) query.endDate = params.endDate + 'T23:59:59.999Z'
    }
    currentPeriodLabel.value = PERIOD_LABELS[period] || '선택 기간'
    const { data } = await systemLogsApi.getStatistics(query)
    stats.value = data
  } catch (err) {
    console.error('Failed to fetch log statistics:', err)
    stats.value = null
  } finally {
    loading.value = false
  }
}

function handleSearch(filters) {
  fetchStats(filters)
}

onMounted(() => fetchStats({ period: '7d' }))
</script>

<template>
  <div class="space-y-6">
    <!-- FilterBar -->
    <UserActivityFilterBar
      :loading="loading"
      :hide-process="true"
      :period-options="statsPeriodOptions"
      default-period="7d"
      :show-end-date="true"
      :max-days="90"
      @search="handleSearch"
    />

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-20">
      <div class="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
        <svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Loading statistics...
      </div>
    </div>

    <!-- Content -->
    <template v-else-if="stats">
      <!-- KPI Cards -->
      <LogKPICards :kpi="stats.kpi" :period-label="currentPeriodLabel" />

      <!-- Row 1: Trend (2/3) + Category Donut (1/3) -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="lg:col-span-2 bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border p-4">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">{{ trendTitle }}</h3>
          <LogTrendChart :data="stats.trend || []" :granularity="stats.granularity || 'hourly'" />
        </div>
        <div class="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border p-4">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">Category Distribution</h3>
          <LogCategoryDonut :data="stats.kpi" />
        </div>
      </div>

      <!-- Row 2: Security Events (1/2) + Top Errors (1/2) -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border p-4">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">
            Security Events
          </h3>
          <LogSecurityChart :data="stats.securityTrend || []" :granularity="stats.granularity || 'hourly'" />
        </div>
        <LogTopErrors :data="stats.topErrors || []" />
      </div>

      <!-- Row 3: Auth Breakdown (1/2) + Batch Health (1/2) -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border p-4">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">Auth Breakdown</h3>
          <LogAuthBreakdownChart :data="stats.authBreakdown || []" />
        </div>
        <div class="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border p-4">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">Batch Health</h3>
          <LogBatchHealthChart :data="stats.batchBreakdown || []" />
        </div>
      </div>

      <!-- Row 4: Top Active Users (1/2) + Recent Audit (1/2) -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border p-4">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">Top Active Users</h3>
          <LogTopUsersChart :data="stats.topUsers || []" />
        </div>
        <div class="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border p-4">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">Recent Audit</h3>
          <LogRecentAuditsTable :data="stats.recentAudits || []" />
        </div>
      </div>
    </template>

    <!-- No data fallback -->
    <div
      v-else
      class="text-center py-16 text-gray-400 dark:text-gray-500 text-sm"
    >
      No statistics available
    </div>
  </div>
</template>
