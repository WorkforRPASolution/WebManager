<script setup>
import { ref, watch, onMounted } from 'vue'
import LogKPICards from './LogKPICards.vue'
import LogTrendChart from './LogTrendChart.vue'
import LogTopErrors from './LogTopErrors.vue'
import { systemLogsApi } from '@/shared/api'

const period = ref('today')
const loading = ref(false)
const stats = ref(null)

const periodOptions = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
  { value: '90d', label: '90 Days' }
]

async function fetchStats() {
  loading.value = true
  try {
    const { data } = await systemLogsApi.getStatistics({ period: period.value })
    stats.value = data
  } catch (err) {
    console.error('Failed to fetch log statistics:', err)
    stats.value = null
  } finally {
    loading.value = false
  }
}

onMounted(fetchStats)

watch(period, fetchStats)
</script>

<template>
  <div class="space-y-6">
    <!-- Period selector -->
    <div class="flex items-center gap-2">
      <button
        v-for="opt in periodOptions"
        :key="opt.value"
        @click="period = opt.value"
        class="px-4 py-2 text-sm font-medium rounded-lg transition-colors"
        :class="period === opt.value
          ? 'bg-primary-500 text-white'
          : 'bg-gray-100 dark:bg-dark-border text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'"
      >
        {{ opt.label }}
      </button>
    </div>

    <!-- Loading spinner -->
    <div
      v-if="loading"
      class="flex items-center justify-center py-20"
    >
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
      <LogKPICards :kpi="stats.kpi" />

      <!-- Two-column: Trend Chart + Top Errors -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Trend Chart -->
        <div class="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border p-4">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">Hourly Trend</h3>
          <LogTrendChart :data="stats.trend || []" />
        </div>

        <!-- Top Errors -->
        <LogTopErrors :data="stats.topErrors || []" />
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
