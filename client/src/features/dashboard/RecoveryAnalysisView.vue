<script setup>
import { ref, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { recoveryApi } from '../../shared/api'
import RecoveryFilterBar from './components/RecoveryFilterBar.vue'
import RecoveryAnalysisTab from './components/RecoveryAnalysisTab.vue'
import RecoveryHistoryModal from './components/RecoveryHistoryModal.vue'
import DataFreshnessIndicator from './components/DataFreshnessIndicator.vue'
import { useToast } from '../../shared/composables/useToast'

const route = useRoute()
const { showError } = useToast()

const activeTab = ref('scenario')
const tabs = [
  { key: 'scenario', label: 'Scenario' },
  { key: 'equipment', label: 'Equipment' },
  { key: 'trigger', label: 'Trigger' }
]

const loading = ref(false)
const analysisData = ref([])
const trendData = ref([])
const granularity = ref('hourly')
const lastAggregation = ref(null)
const processes = ref([])
const scenarios = ref([])
const models = ref([])
const currentFilters = ref({})

// History modal state
const historyVisible = ref(false)
const historyMode = ref('eqpid')
const historyTargetId = ref('')

onMounted(async () => {
  await loadAnalysisFilters()
  const initProcess = route.query.process || (processes.value.length > 0 ? processes.value[0] : '')
  if (initProcess) {
    currentFilters.value.process = initProcess
    // Process → Scenario 캐스케이드
    await handleProcessChange(initProcess)
    fetchData(currentFilters.value)
  }
})

async function loadAnalysisFilters(period, startDate, endDate) {
  try {
    const params = {}
    if (period) params.period = period
    if (startDate) params.startDate = startDate
    if (endDate) params.endDate = endDate
    const res = await recoveryApi.getAnalysisFilters(params)
    processes.value = res.data.processes || []
  } catch (err) {
    console.error('Failed to load analysis filters:', err)
  }
}

async function fetchData(filters = {}) {
  loading.value = true
  try {
    const params = { ...filters, tab: activeTab.value }

    const [analysisRes, aggRes] = await Promise.allSettled([
      recoveryApi.getAnalysis(params),
      recoveryApi.getLastAggregation()
    ])

    if (analysisRes.status === 'fulfilled') {
      analysisData.value = analysisRes.value.data.data || []
      trendData.value = analysisRes.value.data.trend || []
      granularity.value = analysisRes.value.data.granularity || 'hourly'
    } else {
      analysisData.value = []
      trendData.value = []
      showError('분석 데이터 로드에 실패했습니다')
    }

    if (aggRes.status === 'fulfilled') {
      lastAggregation.value = aggRes.value.data
    }
  } catch (err) {
    showError('데이터 로드에 실패했습니다')
  } finally {
    loading.value = false
  }
}

watch(activeTab, () => {
  fetchData(currentFilters.value)
})

// Process 변경 → Scenario 목록 갱신
async function handleProcessChange(process) {
  currentFilters.value.process = process
  currentFilters.value.scenario = ''
  currentFilters.value.model = ''
  try {
    const params = {
      period: currentFilters.value.period || 'today',
      process,
      startDate: currentFilters.value.startDate,
      endDate: currentFilters.value.endDate
    }
    const res = await recoveryApi.getAnalysisFilters(params)
    scenarios.value = res.data.scenarios || []
    models.value = []
  } catch (err) {
    console.error('Failed to load scenarios:', err)
  }
}

// Scenario 변경 (comma-separated) → Model 목록 갱신
async function handleScenarioChange(scenario) {
  currentFilters.value.scenario = scenario || ''
  currentFilters.value.model = ''
  const process = currentFilters.value.process
  if (!process || !scenario) { models.value = []; return }
  try {
    const params = {
      period: currentFilters.value.period || 'today',
      process, scenario,
      startDate: currentFilters.value.startDate,
      endDate: currentFilters.value.endDate
    }
    const res = await recoveryApi.getAnalysisFilters(params)
    models.value = res.data.models || []
  } catch (err) {
    console.error('Failed to load models:', err)
  }
}

async function handlePeriodChange(period) {
  currentFilters.value.period = period
  await loadAnalysisFilters(period)
}

async function handleSearch(filters) {
  currentFilters.value = filters
  // 기간 변경 시 필터 목록 갱신
  await loadAnalysisFilters(filters.period, filters.startDate, filters.endDate)
  // 선택된 process가 새 목록에 없으면 첫 번째로 변경
  if (filters.process && !processes.value.includes(filters.process)) {
    filters.process = processes.value[0] || ''
    currentFilters.value.process = filters.process
    await handleProcessChange(filters.process)
  }
  fetchData(filters)
}

function handleRefresh() {
  fetchData(currentFilters.value)
}

function openHistory(item) {
  historyMode.value = activeTab.value === 'scenario' ? 'ears_code' : 'eqpid'
  historyTargetId.value = item.name || item
  historyVisible.value = true
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div>
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Recovery Analysis</h1>
      <p class="text-gray-500 dark:text-gray-400 mt-1">자동 복구 이력 분석 (Scenario / Equipment / Trigger)</p>
    </div>

    <!-- Filter + Freshness -->
    <div class="bg-white dark:bg-dark-card rounded-xl p-4 shadow-sm border border-gray-200 dark:border-dark-border">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <RecoveryFilterBar
          :processes="processes"
          :scenarios="scenarios"
          :models="models"
          :loading="loading"
          :showModelFilter="true"
          :showScenarioFilter="true"
          :singleSelectMode="true"
          :initialProcess="currentFilters.process || ''"
          @search="handleSearch"
          @process-change="handleProcessChange"
          @scenario-change="handleScenarioChange"
          @period-change="handlePeriodChange"
        />
        <DataFreshnessIndicator :lastAggregation="lastAggregation" @refresh="handleRefresh" />
      </div>
    </div>

    <!-- Tab buttons -->
    <div class="flex gap-1 border-b border-gray-200 dark:border-dark-border">
      <button
        v-for="t in tabs"
        :key="t.key"
        @click="activeTab = t.key"
        :class="[
          'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
          activeTab === t.key
            ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
            : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
        ]"
      >
        {{ t.label }}
      </button>
    </div>

    <!-- Active Tab Content -->
    <RecoveryAnalysisTab
      :data="analysisData"
      :trend="trendData"
      :tab="activeTab"
      :loading="loading"
      :granularity="granularity"
      @history="openHistory"
    />

    <!-- History Modal -->
    <RecoveryHistoryModal
      :visible="historyVisible"
      :mode="historyMode"
      :targetId="historyTargetId"
      @close="historyVisible = false"
    />
  </div>
</template>
