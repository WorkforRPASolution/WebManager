<script setup>
import { ref, onMounted } from 'vue'
import { recoveryApi, clientsApi } from '../../shared/api'
import { useProcessFilterStore } from '../../shared/stores/processFilter'
import { useProcessPermission } from '../../shared/composables/useProcessPermission'
import RecoveryFilterBar from './components/RecoveryFilterBar.vue'
import ModelComparisonChart from './components/ModelComparisonChart.vue'
import ModelTrendChart from './components/ModelTrendChart.vue'
import ModelSummaryTable from './components/ModelSummaryTable.vue'
import ModelDrilldown from './components/ModelDrilldown.vue'
import DataFreshnessIndicator from './components/DataFreshnessIndicator.vue'
import { exportRecoveryByModelCsv } from './utils/recoveryCsvExport'
import { useToast } from '../../shared/composables/useToast'
import { sumByGroup, calcSuccessRate } from './utils/recoveryStatusGroups'

const { showError } = useToast()
const processFilterStore = useProcessFilterStore()
const { buildUserProcessFilter } = useProcessPermission()
const loading = ref(false)
const modelData = ref(null)
const lastAggregation = ref(null)
const expandedModel = ref(null)
const currentFilters = ref({ period: 'today' })
const processes = ref([])

async function loadFilterOptions() {
  try {
    const res = await clientsApi.getProcesses()
    const allProcesses = res.data || []
    processFilterStore.setProcesses('clients', allProcesses)
    processes.value = processFilterStore.getFilteredProcesses('clients')
      .map(p => typeof p === 'string' ? p : p.value)
  } catch (err) {
    console.error('Failed to load processes:', err)
  }
}

async function fetchData(filters = { period: 'today' }) {
  loading.value = true
  currentFilters.value = filters
  try {
    const queryFilters = { ...filters }
    if (!queryFilters.process) {
      const userProcesses = buildUserProcessFilter()
      if (userProcesses) queryFilters.process = userProcesses.join(',')
    }
    const requests = [recoveryApi.getByModel(queryFilters)]
    if (!lastAggregation.value) {
      requests.push(recoveryApi.getLastAggregation())
    }
    const results = await Promise.all(requests)
    modelData.value = results[0].data
    if (results[1]) {
      lastAggregation.value = results[1].data
    }
    expandedModel.value = null
  } catch (err) {
    showError('데이터 로드에 실패했습니다')
    console.error('Recovery by-model fetch error:', err)
  } finally {
    loading.value = false
  }
}

function handleSearch(filters) {
  fetchData(filters)
}

async function handleRefresh() {
  lastAggregation.value = null
  await fetchData(currentFilters.value)
}

function handleExpand(model) {
  expandedModel.value = expandedModel.value === model ? null : model
}

function getDrilldown(model) {
  const drilldownMap = modelData.value?.drilldown
  if (!drilldownMap) return null
  return drilldownMap[model] || null
}

function handleCsvExport() {
  const models = modelData.value?.models
  if (!models || models.length === 0) return
  const mapped = models.map(m => ({
    model: m.model,
    total: m.total || 0,
    success: sumByGroup(m.statusCounts, 'success'),
    failed: sumByGroup(m.statusCounts, 'failed'),
    stopped: sumByGroup(m.statusCounts, 'stopped'),
    skip: sumByGroup(m.statusCounts, 'skip'),
    successRate: calcSuccessRate(m.statusCounts, m.total)
  }))
  exportRecoveryByModelCsv(mapped)
}

onMounted(() => {
  loadFilterOptions()
  fetchData()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div>
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Recovery by Model</h1>
      <p class="text-gray-500 dark:text-gray-400 mt-1">모델별 Recovery 성공률 비교 대시보드</p>
    </div>

    <!-- Filter Bar + Freshness -->
    <div class="bg-white dark:bg-dark-card rounded-xl p-4 shadow-sm border border-gray-200 dark:border-dark-border">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <RecoveryFilterBar
          :processes="processes"
          :loading="loading"
          @search="handleSearch"
        />
        <div class="flex items-center gap-2">
          <DataFreshnessIndicator
            :lastAggregation="lastAggregation"
            @refresh="handleRefresh"
          />
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center py-20">
      <div class="text-center">
        <svg class="animate-spin h-8 w-8 text-blue-500 mx-auto mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p class="text-gray-500 dark:text-gray-400 text-sm">데이터를 불러오는 중...</p>
      </div>
    </div>

    <template v-else-if="modelData">
      <!-- Comparison Chart: Success Rate by Model -->
      <div class="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border p-4">
        <h3 class="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-3">모델별 성공률 비교</h3>
        <ModelComparisonChart :data="modelData.models || []" />
      </div>

      <!-- Row 2: Execution Count (Stacked) + Success Rate Trend (Multi-Line) -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border p-4">
          <h3 class="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-3">모델별 실행 건수</h3>
          <ModelComparisonChart :data="modelData.models || []" mode="stacked" />
        </div>
        <div class="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border p-4">
          <h3 class="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-3">
            모델별 성공률 추이 ({{ { hourly: '시간별', daily: '일별', weekly: '주별', monthly: '월별' }[modelData.granularity] || '일별' }})
          </h3>
          <ModelTrendChart :data="modelData.trend || []" :granularity="modelData.granularity || 'daily'" />
        </div>
      </div>

      <!-- Summary Table with Drilldown -->
      <div class="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border p-4">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-sm font-semibold text-gray-600 dark:text-gray-300">모델별 요약</h3>
          <button
            @click="handleCsvExport"
            class="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-border transition-colors"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            CSV 내보내기
          </button>
        </div>
        <ModelSummaryTable
          :data="modelData.models || []"
          :expandedModel="expandedModel"
          @expand="handleExpand"
        />
        <ModelDrilldown
          v-if="expandedModel"
          :model="expandedModel"
          :drilldown="getDrilldown(expandedModel)"
        />
      </div>
    </template>

    <!-- No Data State -->
    <div v-else class="flex items-center justify-center py-20">
      <p class="text-gray-400 dark:text-gray-500 text-sm">조회 버튼을 눌러 데이터를 불러오세요</p>
    </div>
  </div>
</template>
