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

const { showError } = useToast()
const processFilterStore = useProcessFilterStore()
const { buildUserProcessFilter } = useProcessPermission()

const loading = ref(false)
const data = ref(null)
const processes = ref([])
const currentFilters = ref({ period: 'all' })

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

async function fetchData(filters = { period: 'all' }) {
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
      <div class="grid grid-cols-4 gap-4">
        <div v-for="i in 4" :key="i" class="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border p-4 animate-pulse">
          <div class="h-3 bg-gray-200 dark:bg-gray-700 rounded w-20 mb-2"></div>
          <div class="h-7 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
        </div>
      </div>
    </div>

    <!-- Data Content -->
    <template v-if="data">
      <!-- KPI Cards -->
      <ScenarioKPICards :kpi="data.kpi" />

      <!-- Process Charts (2/3) + Performance (1/3) -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="lg:col-span-2 bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border p-4">
          <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            공정별 시나리오 현황
            <span class="ml-1.5 text-xs font-normal text-gray-400 dark:text-gray-500">Active / Inactive</span>
          </h3>
          <ScenarioProcessChart :data="processChartData" />
        </div>
        <div class="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border p-4">
          <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            공정별 성과 입력률
            <span class="ml-1.5 text-xs font-normal text-gray-400 dark:text-gray-500">Loss 필드 기준</span>
          </h3>
          <ScenarioPerformanceChart :data="processChartData" />
        </div>
      </div>

      <!-- Top 10 Authors + Recent Modifications (side by side) -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border p-4">
          <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            Top 10 작성자
            <span class="ml-1.5 text-xs font-normal text-gray-400 dark:text-gray-500">기간 내 수정 횟수</span>
          </h3>
          <ScenarioTopAuthorsChart :data="data.topAuthors || []" />
        </div>

        <div class="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border p-4">
          <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            최근 수정 이력
            <span class="ml-1.5 text-xs font-normal text-gray-400 dark:text-gray-500">수정 시간 역순</span>
          </h3>
          <ScenarioRecentTable :data="data.recentModifications || []" />
        </div>
      </div>
    </template>
  </div>
</template>
