<script setup>
import { ref, computed, onMounted } from 'vue'
import { recoveryApi, clientsApi } from '../../shared/api'
import { useProcessFilterStore } from '../../shared/stores/processFilter'
import { useProcessPermission } from '../../shared/composables/useProcessPermission'
import { useAuthStore } from '../../shared/stores/auth'
import { useToast } from '../../shared/composables/useToast'
import { sumByGroup } from './utils/recoveryStatusGroups'
import RecoveryFilterBar from './components/RecoveryFilterBar.vue'
import RecoveryKPICards from './components/RecoveryKPICards.vue'
import CategoryComparisonChart from './components/CategoryComparisonChart.vue'
import CategoryTrendChart from './components/CategoryTrendChart.vue'
import CategorySummaryTable from './components/CategorySummaryTable.vue'
import CategoryMappingModal from './components/CategoryMappingModal.vue'
import DataFreshnessIndicator from './components/DataFreshnessIndicator.vue'

const processFilterStore = useProcessFilterStore()
const { buildUserProcessFilter } = useProcessPermission()
const authStore = useAuthStore()
const { showError } = useToast()

const loading = ref(false)
const categoryData = ref(null)
const lastAggregation = ref(null)
const expandedCategory = ref(null)
const currentFilters = ref({ period: 'today' })
const processes = ref([])
const mappingModalVisible = ref(false)

const isAdmin = computed(() => authStore.hasRole([1]))

const kpiCards = computed(() => {
  const k = categoryData.value?.kpi
  if (!k) return []
  return [
    { label: 'Total Executions', value: (k.total || 0).toLocaleString() },
    { label: 'Success Rate', value: k.successRate != null ? `${k.successRate.toFixed(1)}%` : '0%',
      accent: k.successRate >= 90 ? 'text-green-600 dark:text-green-400' : k.successRate >= 70 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400' },
    { label: 'Categories', value: String(k.categoryCount || 0), accent: 'text-blue-600 dark:text-blue-400' },
    { label: 'Uncategorized', value: (k.uncategorizedCount || 0).toLocaleString(),
      accent: k.uncategorizedCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400 dark:text-gray-500' }
  ]
})

const granularityLabel = computed(() => {
  const map = { hourly: 'Hourly', daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' }
  return map[categoryData.value?.granularity] || ''
})

async function fetchProcesses() {
  try {
    const res = await clientsApi.getProcesses()
    const all = (res.data?.data || res.data || []).map(p => typeof p === 'string' ? p : p.process).filter(Boolean)
    processes.value = [...new Set(all)].sort()
  } catch { /* ignore */ }
}

async function fetchData(filters = { period: 'today' }) {
  loading.value = true
  currentFilters.value = filters
  expandedCategory.value = null
  try {
    const queryFilters = { ...filters }
    if (!queryFilters.process) {
      const userProcesses = buildUserProcessFilter()
      if (userProcesses) queryFilters.process = userProcesses.join(',')
    }
    const requests = [recoveryApi.getByCategory(queryFilters)]
    if (!lastAggregation.value) {
      requests.push(recoveryApi.getLastAggregation())
    }
    const results = await Promise.all(requests)
    categoryData.value = results[0].data
    if (results[1]) lastAggregation.value = results[1].data
  } catch {
    showError('데이터 로드에 실패했습니다')
  } finally {
    loading.value = false
  }
}

function handleExpand(scCategory) {
  expandedCategory.value = expandedCategory.value === scCategory ? null : scCategory
}

function handleRefresh() {
  lastAggregation.value = null
  fetchData(currentFilters.value)
}

onMounted(() => {
  fetchProcesses()
  fetchData()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div>
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Recovery by Category</h1>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
        시나리오 카테고리별 Recovery 실행 현황 비교
      </p>
    </div>

    <!-- Filter + Freshness -->
    <div class="flex flex-wrap items-start gap-4">
      <div class="flex-1 min-w-0">
        <RecoveryFilterBar
          :processes="processes"
          :showProcessFilter="true"
          @search="fetchData"
        />
      </div>
      <div class="flex items-center gap-2">
        <DataFreshnessIndicator
          v-if="lastAggregation"
          :lastAggregation="lastAggregation"
          @refresh="handleRefresh"
        />
        <button
          v-if="isAdmin"
          @click="mappingModalVisible = true"
          class="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border
                 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300
                 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          title="Category Name 관리"
        >
          <svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd"/>
          </svg>
          Category
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex flex-col items-center justify-center py-20">
      <svg class="animate-spin w-8 h-8 text-blue-500 mb-3" viewBox="0 0 24 24" fill="none">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
      </svg>
      <span class="text-sm text-gray-500 dark:text-gray-400">Loading...</span>
    </div>

    <!-- Content -->
    <template v-else-if="categoryData">
      <!-- KPI -->
      <RecoveryKPICards :customCards="kpiCards" />

      <!-- Charts Row -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border p-4">
          <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Category Comparison (Success Rate %)</h3>
          <CategoryComparisonChart :data="categoryData.categories || []" />
        </div>
        <div class="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border p-4">
          <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            Category Trend
            <span v-if="granularityLabel" class="text-xs font-normal text-gray-400 dark:text-gray-500 ml-1">({{ granularityLabel }})</span>
          </h3>
          <CategoryTrendChart
            :data="categoryData.trend || []"
            :granularity="categoryData.granularity || 'daily'"
          />
        </div>
      </div>

      <!-- Summary Table -->
      <div class="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border p-4">
        <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Category Summary</h3>
        <CategorySummaryTable
          :data="categoryData.categories || []"
          :expandedCategory="expandedCategory"
          @expand="handleExpand"
        />
      </div>
    </template>

    <!-- No Data -->
    <div v-else class="flex items-center justify-center py-20 text-gray-400 dark:text-gray-500 text-sm">
      데이터가 없습니다. 기간을 선택한 후 조회하세요.
    </div>

    <!-- Mapping Modal -->
    <CategoryMappingModal
      v-model:visible="mappingModalVisible"
      @saved="fetchData(currentFilters)"
    />
  </div>
</template>
