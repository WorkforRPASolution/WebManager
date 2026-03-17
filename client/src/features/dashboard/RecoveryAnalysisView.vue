<script setup>
import { ref, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { recoveryApi, clientsApi } from '../../shared/api'
import { useProcessFilterStore } from '../../shared/stores/processFilter'
import { useProcessPermission } from '../../shared/composables/useProcessPermission'
import RecoveryFilterBar from './components/RecoveryFilterBar.vue'
import RecoveryAnalysisTab from './components/RecoveryAnalysisTab.vue'
import RecoveryHistoryModal from './components/RecoveryHistoryModal.vue'
import DataFreshnessIndicator from './components/DataFreshnessIndicator.vue'
import { useToast } from '../../shared/composables/useToast'

const route = useRoute()
const { showError } = useToast()
const processFilterStore = useProcessFilterStore()
const { buildUserProcessFilter } = useProcessPermission()

const activeTab = ref('scenario')
const tabs = [
  { key: 'scenario', label: 'Scenario' },
  { key: 'equipment', label: 'Equipment' },
  { key: 'trigger', label: 'Trigger' }
]

const loading = ref(false)
const analysisData = ref([])
const trendData = ref([])
const lastAggregation = ref(null)
const processes = ref([])
const models = ref([])
const currentFilters = ref({})

// History modal state
const historyVisible = ref(false)
const historyMode = ref('eqpid')
const historyTargetId = ref('')

onMounted(() => {
  loadFilterOptions()
  // Auto-apply process filter from navigation query
  if (route.query.process) {
    currentFilters.value.process = route.query.process
  }
  fetchData(currentFilters.value)
})

async function loadFilterOptions() {
  try {
    const [procRes, modelRes] = await Promise.allSettled([
      clientsApi.getProcesses(),
      clientsApi.getModels()
    ])
    if (procRes.status === 'fulfilled') {
      const allProcesses = procRes.value.data || []
      processFilterStore.setProcesses('clients', allProcesses)
      processes.value = processFilterStore.getFilteredProcesses('clients')
    }
    if (modelRes.status === 'fulfilled') {
      models.value = modelRes.value.data || []
    }
  } catch (err) {
    console.error('Failed to load filter options:', err)
  }
}

async function fetchData(filters = {}) {
  loading.value = true
  try {
    const params = { ...filters, tab: activeTab.value }

    // Apply user process permission if no process filter selected
    if (!params.process) {
      const userProcesses = buildUserProcessFilter()
      if (userProcesses) params.process = userProcesses.join(',')
    }

    const [analysisRes, aggRes] = await Promise.allSettled([
      recoveryApi.getAnalysis(params),
      recoveryApi.getLastAggregation()
    ])

    if (analysisRes.status === 'fulfilled') {
      analysisData.value = analysisRes.value.data.data || []
    } else {
      analysisData.value = []
      showError('분석 데이터 로드에 실패했습니다')
    }

    if (aggRes.status === 'fulfilled') {
      lastAggregation.value = aggRes.value.data
    }

    trendData.value = []
  } catch (err) {
    showError('데이터 로드에 실패했습니다')
  } finally {
    loading.value = false
  }
}

async function fetchTrend(itemName) {
  if (!itemName) {
    trendData.value = []
    return
  }
  try {
    const params = {
      ...currentFilters.value,
      tab: activeTab.value,
      item: itemName
    }

    if (!params.process) {
      const userProcesses = buildUserProcessFilter()
      if (userProcesses) params.process = userProcesses.join(',')
    }

    const res = await recoveryApi.getAnalysis(params)
    trendData.value = res.data.trend || []
  } catch (err) {
    console.error('Failed to fetch trend:', err)
    trendData.value = []
  }
}

watch(activeTab, () => {
  trendData.value = []
  fetchData(currentFilters.value)
})

function handleSearch(filters) {
  currentFilters.value = filters
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
          :models="models"
          :loading="loading"
          :showLineFilter="false"
          :showModelFilter="true"
          @search="handleSearch"
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
      @history="openHistory"
      @fetch-trend="fetchTrend"
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
