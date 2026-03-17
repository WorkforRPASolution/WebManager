<script setup>
import { ref, onMounted } from 'vue'
import { recoveryApi } from '../../shared/api'
import RecoveryFilterBar from './components/RecoveryFilterBar.vue'
import ProcessComparisonChart from './components/ProcessComparisonChart.vue'
import ProcessTrendChart from './components/ProcessTrendChart.vue'
import ProcessSummaryTable from './components/ProcessSummaryTable.vue'
import ProcessDrilldown from './components/ProcessDrilldown.vue'
import DataFreshnessIndicator from './components/DataFreshnessIndicator.vue'
import { exportRecoveryByProcessCsv } from './utils/recoveryCsvExport'
import { useToast } from '../../shared/composables/useToast'
import { sumByGroup, calcSuccessRate } from './utils/recoveryStatusGroups'

const { showError } = useToast()
const loading = ref(false)
const processData = ref(null)
const lastAggregation = ref(null)
const expandedProcess = ref(null)
const currentFilters = ref({ period: 'today' })
const lines = ref([])

async function fetchData(filters = { period: 'today' }) {
  loading.value = true
  currentFilters.value = filters
  try {
    const requests = [recoveryApi.getByProcess(filters)]
    if (!lastAggregation.value) {
      requests.push(recoveryApi.getLastAggregation())
    }
    const results = await Promise.all(requests)
    processData.value = results[0].data
    if (results[1]) {
      lastAggregation.value = results[1].data
    }
    expandedProcess.value = null
  } catch (err) {
    showError('데이터 로드에 실패했습니다')
    console.error('Recovery by-process fetch error:', err)
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

function handleExpand(process) {
  expandedProcess.value = expandedProcess.value === process ? null : process
}

function getDrilldown(process) {
  const drilldowns = processData.value?.drilldowns
  if (!drilldowns) return null
  return drilldowns[process] || null
}

function handleCsvExport() {
  const processes = processData.value?.processes
  if (!processes || processes.length === 0) return
  // Map to the format expected by exportRecoveryByProcessCsv
  const mapped = processes.map(p => ({
    process: p.process,
    total: p.total || 0,
    success: sumByGroup(p.statusCounts, 'success'),
    failed: sumByGroup(p.statusCounts, 'failed'),
    stopped: sumByGroup(p.statusCounts, 'stopped'),
    skip: sumByGroup(p.statusCounts, 'skip'),
    successRate: calcSuccessRate(p.statusCounts, p.total)
  }))
  exportRecoveryByProcessCsv(mapped)
}

onMounted(() => {
  fetchData()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div>
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Recovery by Process</h1>
      <p class="text-gray-500 dark:text-gray-400 mt-1">공정별 Recovery 성공률 비교 대시보드</p>
    </div>

    <!-- Filter Bar + Freshness -->
    <div class="bg-white dark:bg-dark-card rounded-xl p-4 shadow-sm border border-gray-200 dark:border-dark-border">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <RecoveryFilterBar
          :lines="lines"
          :loading="loading"
          :showProcessFilter="false"
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

    <template v-else-if="processData">
      <!-- Comparison Chart: Success Rate by Process -->
      <div class="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border p-4">
        <h3 class="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-3">공정별 성공률 비교</h3>
        <ProcessComparisonChart :data="processData.processes || []" />
      </div>

      <!-- Row 2: Execution Count (Stacked) + Success Rate Trend (Multi-Line) -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border p-4">
          <h3 class="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-3">공정별 실행 건수</h3>
          <ProcessComparisonChart :data="processData.processes || []" mode="stacked" />
        </div>
        <div class="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border p-4">
          <h3 class="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-3">공정별 성공률 추이</h3>
          <ProcessTrendChart :data="processData.trend || []" />
        </div>
      </div>

      <!-- Summary Table with Drilldown -->
      <div class="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border p-4">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-sm font-semibold text-gray-600 dark:text-gray-300">공정별 요약</h3>
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
        <ProcessSummaryTable
          :data="processData.processes || []"
          :expandedProcess="expandedProcess"
          @expand="handleExpand"
        />
        <ProcessDrilldown
          v-if="expandedProcess"
          :process="expandedProcess"
          :drilldown="getDrilldown(expandedProcess)"
          :period="currentFilters.period"
        />
      </div>
    </template>

    <!-- No Data State -->
    <div v-else class="flex items-center justify-center py-20">
      <p class="text-gray-400 dark:text-gray-500 text-sm">조회 버튼을 눌러 데이터를 불러오세요</p>
    </div>
  </div>
</template>
