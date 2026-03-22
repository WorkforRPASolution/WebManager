<script setup>
import { ref, computed, onMounted } from 'vue'
import { clientsApi, userActivityApi } from '../../../shared/api'
import { useProcessFilterStore } from '../../../shared/stores/processFilter'
import { useProcessPermission } from '../../../shared/composables/useProcessPermission'
import { useToast } from '../../../shared/composables/useToast'
import UserActivityFilterBar from './UserActivityFilterBar.vue'
import ScenarioKPICards from './ScenarioKPICards.vue'
import ScenarioProcessChart from './ScenarioProcessChart.vue'
import ScenarioPerformanceChart from './ScenarioPerformanceChart.vue'
import ScenarioTopAuthorsChart from './ScenarioTopAuthorsChart.vue'
import ScenarioRecentTable from './ScenarioRecentTable.vue'
import {
  exportScenarioProcessCsv,
  exportScenarioProcessDetailCsv,
  exportScenarioPerformanceCsv,
  exportScenarioPerformanceDetailCsv,
  exportScenarioRecentCsv
} from '../utils/csvExport'

const { showError } = useToast()
const processFilterStore = useProcessFilterStore()
const { buildUserProcessFilter } = useProcessPermission()

const loading = ref(false)
const data = ref(null)
const processes = ref([])
const currentFilters = ref({ period: '7d' })

// Toggle state
const includeEmptyProcesses = ref(false)

// Process chart data with empty processes merged
const processChartData = computed(() => {
  const summary = data.value?.processSummary || []
  if (!includeEmptyProcesses.value) return summary

  const selectedProcs = currentFilters.value.process
    ? currentFilters.value.process.split(',').map(p => p.trim())
    : processes.value
  const existing = new Set(summary.map(p => p.process))
  const empty = selectedProcs
    .filter(p => !existing.has(p))
    .map(p => ({ process: p, total: 0, active: 0, inactive: 0, performanceFilled: 0, performanceRate: 0 }))
  return [...summary, ...empty].sort((a, b) => a.process.localeCompare(b.process))
})

async function fetchData(filters = { period: '7d' }) {
  loading.value = true
  currentFilters.value = filters
  try {
    const queryFilters = { ...filters }
    if (!queryFilters.process) {
      const userProcesses = buildUserProcessFilter()
      if (userProcesses) queryFilters.process = userProcesses.join(',')
    }
    const res = await userActivityApi.getScenarioStats(queryFilters)
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

function toggleEmptyProcesses() {
  includeEmptyProcesses.value = !includeEmptyProcesses.value
}

// CSV dropdown for process chart
const processCsvMenuOpen = ref(false)

function handleProcessCsvExport(type) {
  processCsvMenuOpen.value = false
  if (type === 'summary') {
    exportScenarioProcessCsv(processChartData.value)
  } else {
    exportProcessDetailCsv()
  }
}

// CSV dropdown for performance chart
const perfCsvMenuOpen = ref(false)

function handlePerfCsvExport(type) {
  perfCsvMenuOpen.value = false
  if (type === 'summary') {
    exportScenarioPerformanceCsv(processChartData.value)
  } else {
    exportPerfDetailCsv()
  }
}

async function exportPerfDetailCsv() {
  try {
    const queryFilters = {}
    if (currentFilters.value.process) {
      queryFilters.process = currentFilters.value.process
    } else {
      const userProcesses = buildUserProcessFilter()
      if (userProcesses) queryFilters.process = userProcesses.join(',')
    }
    const res = await userActivityApi.getScenarioDetails(queryFilters)
    exportScenarioPerformanceDetailCsv(res.data)
  } catch (err) {
    showError('CSV 내보내기에 실패했습니다')
  }
}

async function handleExportRecentCsv() {
  try {
    const queryFilters = { ...currentFilters.value, noLimit: 'true' }
    if (!queryFilters.process) {
      const userProcesses = buildUserProcessFilter()
      if (userProcesses) queryFilters.process = userProcesses.join(',')
    }
    const res = await userActivityApi.getScenarioStats(queryFilters)
    exportScenarioRecentCsv(res.data.recentModifications || [])
  } catch (err) {
    showError('CSV 내보내기에 실패했습니다')
  }
}

async function exportProcessDetailCsv() {
  try {
    const queryFilters = {}
    if (currentFilters.value.process) {
      queryFilters.process = currentFilters.value.process
    } else {
      const userProcesses = buildUserProcessFilter()
      if (userProcesses) queryFilters.process = userProcesses.join(',')
    }
    const res = await userActivityApi.getScenarioDetails(queryFilters)
    exportScenarioProcessDetailCsv(res.data)
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
        default-period="7d"
        @search="handleSearch"
      />
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
      </div>
    </div>

    <!-- Loading Skeleton -->
    <div v-if="loading && !data" class="space-y-6">
      <div class="flex flex-wrap gap-4">
        <div v-for="i in 5" :key="i" class="flex-1 min-w-[160px] bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border p-4 animate-pulse">
          <div class="h-3 bg-gray-200 dark:bg-gray-700 rounded w-20 mb-2"></div>
          <div class="h-7 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
        </div>
      </div>
    </div>

    <!-- Data Content -->
    <template v-if="data">
      <!-- KPI Cards -->
      <ScenarioKPICards :kpi="data.kpi" />

      <!-- Process Charts (1/2) + Performance (1/2) -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border p-4">
          <div class="flex items-center justify-between mb-2">
            <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">
              공정별 시나리오 현황
              <span class="ml-1.5 text-xs font-normal text-gray-400 dark:text-gray-500">Active / Inactive</span>
            </h3>
            <div v-if="processChartData.length > 0" class="relative">
              <button @click="processCsvMenuOpen = !processCsvMenuOpen" class="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-border transition-colors">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                CSV
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
              </button>
              <div v-if="processCsvMenuOpen" class="absolute right-0 mt-1 w-40 bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-lg shadow-lg z-10">
                <button @click="handleProcessCsvExport('summary')" class="w-full px-4 py-2 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-border rounded-t-lg">요약 (공정별)</button>
                <button @click="handleProcessCsvExport('detail')" class="w-full px-4 py-2 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-border rounded-b-lg">상세 (시나리오별)</button>
              </div>
            </div>
          </div>
          <ScenarioProcessChart :data="processChartData" />
        </div>
        <div class="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border p-4">
          <div class="flex items-center justify-between mb-2">
            <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">
              공정별 성과 입력률
              <span class="ml-1.5 text-xs font-normal text-gray-400 dark:text-gray-500">Loss 필드 기준</span>
            </h3>
            <div v-if="processChartData.length > 0" class="relative">
              <button @click="perfCsvMenuOpen = !perfCsvMenuOpen" class="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-border transition-colors">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                CSV
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
              </button>
              <div v-if="perfCsvMenuOpen" class="absolute right-0 mt-1 w-40 bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-lg shadow-lg z-10">
                <button @click="handlePerfCsvExport('summary')" class="w-full px-4 py-2 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-border rounded-t-lg">요약 (공정별)</button>
                <button @click="handlePerfCsvExport('detail')" class="w-full px-4 py-2 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-border rounded-b-lg">상세 (시나리오별)</button>
              </div>
            </div>
          </div>
          <ScenarioPerformanceChart :data="processChartData" />
        </div>
      </div>

      <!-- Top 10 Authors (1/3) + Recent Modifications (2/3) -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border p-4">
          <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            Top 10 작성자
            <span class="ml-1.5 text-xs font-normal text-gray-400 dark:text-gray-500">기간 내 수정 횟수</span>
          </h3>
          <ScenarioTopAuthorsChart :data="data.topAuthors || []" />
        </div>

        <div class="lg:col-span-2 bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border p-4">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">
              최근 수정 이력
              <span class="ml-1.5 text-xs font-normal text-gray-400 dark:text-gray-500">수정 시간 역순</span>
            </h3>
            <button v-if="(data.recentModifications || []).length > 0" @click="handleExportRecentCsv" class="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-border transition-colors">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              CSV
            </button>
          </div>
          <ScenarioRecentTable :data="data.recentModifications || []" />
        </div>
      </div>
    </template>
  </div>
</template>
