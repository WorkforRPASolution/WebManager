<script setup>
import { ref, computed, onMounted } from 'vue'
import { clientsApi, userActivityApi } from '../../../shared/api'
import { useProcessFilterStore } from '../../../shared/stores/processFilter'
import { useProcessPermission } from '../../../shared/composables/useProcessPermission'
import { useToast } from '../../../shared/composables/useToast'
import UserActivityFilterBar from './UserActivityFilterBar.vue'
import UserActivityKPICards from './UserActivityKPICards.vue'
import UserActivityDonutChart from './UserActivityDonutChart.vue'
import UserActivityTopUsersChart from './UserActivityTopUsersChart.vue'
import UserActivityProcessChart from './UserActivityProcessChart.vue'
import UserActivityRecentTable from './UserActivityRecentTable.vue'
import {
  exportToolUsageProcessCsv,
  exportToolUsageRecentUsersCsv
} from '../utils/csvExport'

const { showError } = useToast()
const processFilterStore = useProcessFilterStore()
const { buildUserProcessFilter } = useProcessPermission()

const loading = ref(false)
const data = ref(null)
const processes = ref([])
const currentFilters = ref({ period: 'all' })

// Toggle states
const includeEmptyProcesses = ref(false)
const includeAdmin = ref(false)

// Process chart data with empty processes merged
const processChartData = computed(() => {
  const summary = data.value?.processSummary || []
  if (!includeEmptyProcesses.value) return summary

  // 프로세스 필터 활성 시 선택된 공정 범위 내에서만 빈 공정 추가
  const selectedProcs = currentFilters.value.process
    ? currentFilters.value.process.split(',').map(p => p.trim())
    : processes.value
  const existing = new Set(summary.map(p => p.process))
  const empty = selectedProcs
    .filter(p => !existing.has(p))
    .map(p => ({ process: p, totalUsers: 0, activeUsers: 0, usageRate: 0 }))
  return [...summary, ...empty].sort((a, b) => a.process.localeCompare(b.process))
})

async function fetchData(filters = { period: 'all' }) {
  loading.value = true
  currentFilters.value = filters
  try {
    const queryFilters = { ...filters }
    if (!queryFilters.process) {
      const userProcesses = buildUserProcessFilter()
      if (userProcesses) queryFilters.process = userProcesses.join(',')
    }
    if (includeAdmin.value) {
      queryFilters.includeAdmin = 'true'
    }
    const res = await userActivityApi.getToolUsage(queryFilters)
    data.value = res.data
  } catch (err) {
    showError('데이터 로드에 실패했습니다')
  } finally {
    loading.value = false
  }
}

async function loadFilterOptions() {
  try {
    const res = await clientsApi.getProcesses()
    const allProcesses = res.data || []
    processFilterStore.setProcesses('clients', allProcesses)
    processes.value = processFilterStore.getFilteredProcesses('clients')
  } catch (err) {
    // silently fail
  }
}

function handleSearch(filters) {
  fetchData(filters)
}

function toggleIncludeAdmin() {
  includeAdmin.value = !includeAdmin.value
  fetchData(currentFilters.value)
}

function toggleEmptyProcesses() {
  includeEmptyProcesses.value = !includeEmptyProcesses.value
  // No re-fetch needed — computed handles it
}

async function handleExportRecentUsersCsv() {
  try {
    const queryFilters = { ...currentFilters.value, noLimit: 'true' }
    if (!queryFilters.process) {
      const userProcesses = buildUserProcessFilter()
      if (userProcesses) queryFilters.process = userProcesses.join(',')
    }
    if (includeAdmin.value) queryFilters.includeAdmin = 'true'
    const res = await userActivityApi.getToolUsage(queryFilters)
    exportToolUsageRecentUsersCsv(res.data.recentUsers || [])
  } catch (err) {
    showError('CSV 내보내기에 실패했습니다')
  }
}

onMounted(() => {
  loadFilterOptions()
  fetchData()
})
</script>

<template>
  <div class="p-6 space-y-6">
    <!-- Filter Bar + Toggles -->
    <div class="flex flex-wrap items-end gap-3">
      <UserActivityFilterBar
        :processes="processes"
        :loading="loading"
        @search="handleSearch"
      />
      <!-- Toggles -->
      <div class="flex items-center gap-3 ml-auto">
        <button
          @click="toggleEmptyProcesses"
          class="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-colors"
          :class="includeEmptyProcesses
            ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300'
            : 'bg-white dark:bg-dark-card border-gray-300 dark:border-dark-border text-gray-500 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500'"
        >
          <span class="w-3 h-3 rounded-sm border flex items-center justify-center"
            :class="includeEmptyProcesses ? 'bg-blue-600 border-blue-600' : 'border-gray-400 dark:border-gray-500'">
            <svg v-if="includeEmptyProcesses" class="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
          </span>
          사용자미등록 공정포함
        </button>
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
      <div class="grid grid-cols-3 gap-4">
        <div v-for="i in 3" :key="i" class="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border p-4 animate-pulse">
          <div class="h-3 bg-gray-200 dark:bg-gray-700 rounded w-20 mb-2"></div>
          <div class="h-7 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
        </div>
      </div>
    </div>

    <!-- Data Content -->
    <template v-if="data">
      <!-- KPI Cards -->
      <UserActivityKPICards :kpi="data.kpi" />

      <!-- Process Chart (2/3) + Donut (1/3) -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="lg:col-span-2 bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border p-4">
          <div class="flex items-center justify-between mb-2">
            <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">
              공정별 사용 현황
              <span class="ml-1.5 text-xs font-normal text-gray-400 dark:text-gray-500">다중 공정 사용자 중복 포함</span>
            </h3>
            <button v-if="processChartData.length > 0" @click="exportToolUsageProcessCsv(processChartData)" class="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-border transition-colors">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              CSV
            </button>
          </div>
          <UserActivityProcessChart :data="processChartData" />
        </div>
        <div class="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border p-4">
          <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            공정별 Active 분포
            <span class="ml-1.5 text-xs font-normal text-gray-400 dark:text-gray-500">중복 포함</span>
          </h3>
          <UserActivityDonutChart :processSummary="processChartData" />
        </div>
      </div>

      <!-- Top 10 + Recent Users (side by side) -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border p-4">
          <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            Top 10 — 누적 실행 횟수
            <span class="ml-1.5 text-xs font-normal text-gray-400 dark:text-gray-500">accessnum 기준</span>
          </h3>
          <UserActivityTopUsersChart :data="data.topUsers || []" />
        </div>

        <div class="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border p-4">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">
              최근 실행 사용자
              <span class="ml-1.5 text-xs font-normal text-gray-400 dark:text-gray-500">최근 SE 실행 시간 역순</span>
            </h3>
            <button v-if="(data.recentUsers || []).length > 0" @click="handleExportRecentUsersCsv" class="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-border transition-colors">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              CSV
            </button>
          </div>
          <UserActivityRecentTable :data="data.recentUsers || []" />
        </div>
      </div>
    </template>
  </div>
</template>
