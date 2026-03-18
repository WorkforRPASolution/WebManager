<script setup>
import { ref, onMounted } from 'vue'
import { clientsApi, recoveryApi } from '../../shared/api'
import { useProcessFilterStore } from '../../shared/stores/processFilter'
import { useProcessPermission } from '../../shared/composables/useProcessPermission'
import { useAuthStore } from '../../shared/stores/auth'
import RecoveryFilterBar from './components/RecoveryFilterBar.vue'
import RecoveryKPICards from './components/RecoveryKPICards.vue'
import RecoveryTrendChart from './components/RecoveryTrendChart.vue'
import RecoveryStatusDonut from './components/RecoveryStatusDonut.vue'
import RecoveryTop10Chart from './components/RecoveryTop10Chart.vue'
import RecoveryTriggerChart from './components/RecoveryTriggerChart.vue'
import DataFreshnessIndicator from './components/DataFreshnessIndicator.vue'
import RecoveryBackfillModal from './components/RecoveryBackfillModal.vue'
import { useToast } from '../../shared/composables/useToast'
import { exportRecoveryOverviewCsv } from './utils/recoveryCsvExport'

const { showError } = useToast()
const processFilterStore = useProcessFilterStore()
const { buildUserProcessFilter } = useProcessPermission()
const authStore = useAuthStore()
const isAdmin = authStore.hasRole([1])
const backfillModalVisible = ref(false)
const loading = ref(false)
const overviewData = ref(null)
const lastAggregation = ref(null)
const processes = ref([])
const lines = ref([])
const csvMenuOpen = ref(false)
const currentFilters = ref({ period: 'today' })

async function fetchData(filters = { period: 'today' }) {
  loading.value = true
  currentFilters.value = filters
  try {
    // process 필터 미선택 시 사용자 권한 기반 제한
    const queryFilters = { ...filters }
    if (!queryFilters.process) {
      const userProcesses = buildUserProcessFilter()
      if (userProcesses) queryFilters.process = userProcesses.join(',')
    }
    const requests = [recoveryApi.getOverview(queryFilters)]
    // lastAggregation은 처음 한 번만 또는 refresh 시 호출
    if (!lastAggregation.value) {
      requests.push(recoveryApi.getLastAggregation())
    }
    const results = await Promise.all(requests)
    overviewData.value = results[0].data
    if (results[1]) {
      lastAggregation.value = results[1].data
    }
  } catch (err) {
    showError('데이터 로드에 실패했습니다')
    console.error('Recovery overview fetch error:', err)
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
    console.error('Failed to load processes:', err)
  }
}

function handleSearch(filters) {
  fetchData(filters)
}

async function handleRefresh() {
  lastAggregation.value = null
  await fetchData(currentFilters.value)
}

function handleCsvExport() {
  csvMenuOpen.value = false
  const d = overviewData.value
  if (!d) return
  exportRecoveryOverviewCsv(d.kpi, d.trend)
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
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Recovery Overview</h1>
      <p class="text-gray-500 dark:text-gray-400 mt-1">Recovery 실행 현황 종합 대시보드</p>
    </div>

    <!-- Filter Bar + Freshness -->
    <div class="bg-white dark:bg-dark-card rounded-xl p-4 shadow-sm border border-gray-200 dark:border-dark-border">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <RecoveryFilterBar
          :processes="processes"
          :lines="lines"
          :loading="loading"
          @search="handleSearch"
        />
        <div class="flex items-center gap-2">
          <DataFreshnessIndicator
            :lastAggregation="lastAggregation"
            @refresh="handleRefresh"
          />
          <!-- Backfill (Admin only) -->
          <button
            v-if="isAdmin"
            @click="backfillModalVisible = true"
            class="p-1.5 text-gray-500 dark:text-gray-400 hover:text-orange-500 dark:hover:text-orange-400 hover:bg-gray-100 dark:hover:bg-dark-border rounded-lg transition-colors"
            title="Backfill 관리"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          <!-- CSV Export -->
          <div v-if="overviewData" class="relative csv-dropdown">
            <button
              @click="handleCsvExport"
              class="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-border transition-colors"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              CSV
            </button>
          </div>
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

    <template v-else-if="overviewData">
      <!-- KPI Cards -->
      <RecoveryKPICards :kpi="overviewData.kpi" />

      <!-- Charts Row 1: Trend + Donut -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="lg:col-span-2 bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border p-4">
          <h3 class="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-3">
            {{ { hourly: '시간별', daily: '일별', weekly: '주별', monthly: '월별' }[overviewData.granularity] || '시간별' }} 트렌드
          </h3>
          <RecoveryTrendChart :data="overviewData.trend || []" :granularity="overviewData.granularity || 'hourly'" />
        </div>
        <div class="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border p-4">
          <h3 class="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-3">상태 분포</h3>
          <RecoveryStatusDonut
            :statusDistribution="overviewData.statusDistribution || {}"
            :successRate="overviewData.kpi?.successRate || 0"
          />
        </div>
      </div>

      <!-- Charts Row 2: Top 10 Scenarios + Top 10 Equipment + Trigger Distribution -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border p-4">
          <h3 class="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-3">Top 10 실패 시나리오</h3>
          <RecoveryTop10Chart :data="overviewData.topScenarios || []" color="#ef4444" />
        </div>
        <div class="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border p-4">
          <h3 class="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-3">Top 10 실패 장비</h3>
          <RecoveryTop10Chart :data="overviewData.topEquipment || []" color="#f59e0b" />
        </div>
        <div class="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border p-4">
          <h3 class="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-3">Trigger 분포</h3>
          <RecoveryTriggerChart :data="overviewData.triggerDistribution || []" />
        </div>
      </div>
    </template>

    <!-- No Data State -->
    <div v-else class="flex items-center justify-center py-20">
      <p class="text-gray-400 dark:text-gray-500 text-sm">조회 버튼을 눌러 데이터를 불러오세요</p>
    </div>

    <!-- Backfill Modal -->
    <RecoveryBackfillModal
      :visible="backfillModalVisible"
      @close="backfillModalVisible = false"
    />
  </div>
</template>
