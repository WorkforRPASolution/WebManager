<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { clientsApi, dashboardApi } from '../../shared/api'
import { useProcessFilterStore } from '../../shared/stores/processFilter'
import { useProcessPermission } from '../../shared/composables/useProcessPermission'
import { useToast } from '../../shared/composables/useToast'
import AgentMonitorFilterBar from './components/AgentMonitorFilterBar.vue'
import ResourceAgentStatusDonutChart from './components/ResourceAgentStatusDonutChart.vue'
import ResourceAgentStatusBarChart from './components/ResourceAgentStatusBarChart.vue'
import ResourceAgentStatusTable from './components/ResourceAgentStatusTable.vue'
import { exportResourceAgentStatusCsv, exportResourceAgentStatusDetailCsv } from './utils/csvExport'

const processFilterStore = useProcessFilterStore()
const { buildUserProcessFilter } = useProcessPermission()
const { showError } = useToast()

const data = ref([])
const loading = ref(false)
const csvExporting = ref(false)
const redisAvailable = ref(true)
const groupByModel = ref(false)
const csvMenuOpen = ref(false)

// Filter options
const processes = ref([])
const models = ref([])

const totalAgent = ref(0)
const totalOk = ref(0)
const totalWarn = ref(0)
const totalShutdown = ref(0)
const totalStopped = ref(0)

// Sort
const sortBy = ref('name')
const sortAsc = ref(true)

const sortedData = computed(() => {
  const arr = [...data.value]
  arr.sort((a, b) => {
    let cmp
    if (sortBy.value === 'count') {
      cmp = a.agentCount - b.agentCount
    } else {
      const labelA = groupByModel.value ? `${a.process}\0${a.eqpModel}` : a.process
      const labelB = groupByModel.value ? `${b.process}\0${b.eqpModel}` : b.process
      cmp = labelA.localeCompare(labelB)
    }
    return sortAsc.value ? cmp : -cmp
  })
  return arr
})

async function loadProcesses() {
  try {
    const res = await clientsApi.getProcesses()
    const allProcesses = res.data || []
    processFilterStore.setProcesses('clients', allProcesses)
    processes.value = processFilterStore.getFilteredProcesses('clients')
  } catch (err) {
    console.error('Failed to load processes:', err)
  }
}

async function loadModels(process) {
  try {
    const res = await clientsApi.getModels(process || undefined)
    models.value = res.data || []
  } catch (err) {
    console.error('Failed to load models:', err)
  }
}

async function fetchData(params = {}) {
  loading.value = true
  try {
    const queryParams = {}
    if (params.process) {
      queryParams.process = params.process
    } else {
      const userProcesses = buildUserProcessFilter()
      if (userProcesses) queryParams.process = userProcesses.join(',')
    }
    if (params.groupByModel) queryParams.groupByModel = 'true'
    if (params.eqpModel) queryParams.eqpModel = params.eqpModel

    const res = await dashboardApi.getResourceAgentStatus(queryParams)
    data.value = res.data.data || []
    redisAvailable.value = res.data.redisAvailable
    groupByModel.value = !!params.groupByModel

    totalAgent.value = data.value.reduce((sum, r) => sum + r.agentCount, 0)
    totalOk.value = data.value.reduce((sum, r) => sum + r.okCount, 0)
    totalWarn.value = data.value.reduce((sum, r) => sum + r.warnCount, 0)
    totalShutdown.value = data.value.reduce((sum, r) => sum + r.shutdownCount, 0)
    totalStopped.value = data.value.reduce((sum, r) => sum + (r.stoppedCount || 0), 0)
  } catch (err) {
    console.error('Failed to fetch resource agent status:', err)
    data.value = []
  } finally {
    loading.value = false
  }
}

function handleProcessChange(processes) {
  const param = Array.isArray(processes) ? processes.join(',') : (processes || undefined)
  loadModels(param)
}

let lastSearchParams = {}

function handleSearch(params) {
  lastSearchParams = params
  fetchData(params)
}

async function handleCsvExport(type) {
  csvMenuOpen.value = false
  if (type === 'summary') {
    exportResourceAgentStatusCsv(sortedData.value, groupByModel.value)
  } else {
    csvExporting.value = true
    try {
      const queryParams = {}
      if (lastSearchParams.process) queryParams.process = lastSearchParams.process
      else {
        const userProcesses = buildUserProcessFilter()
        if (userProcesses) queryParams.process = userProcesses.join(',')
      }
      if (lastSearchParams.groupByModel) queryParams.groupByModel = 'true'
      if (lastSearchParams.eqpModel) queryParams.eqpModel = lastSearchParams.eqpModel
      queryParams.includeDetails = 'true'
      const res = await dashboardApi.getResourceAgentStatus(queryParams)
      exportResourceAgentStatusDetailCsv(res.data.details || [])
    } catch (err) {
      showError('CSV 내보내기에 실패했습니다')
    } finally {
      csvExporting.value = false
    }
  }
}

function closeCsvMenu(e) {
  if (csvMenuOpen.value && !e.target.closest('.csv-dropdown')) {
    csvMenuOpen.value = false
  }
}

onMounted(() => {
  loadProcesses()
  fetchData()
  document.addEventListener('click', closeCsvMenu)
})

onUnmounted(() => {
  document.removeEventListener('click', closeCsvMenu)
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div>
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">ResourceAgent Status</h1>
      <p class="text-gray-500 dark:text-gray-400 mt-1">Process별 ResourceAgent 가동 현황</p>
    </div>

    <!-- Filter Bar -->
    <div class="bg-white dark:bg-dark-card rounded-xl p-4 shadow-sm border border-gray-200 dark:border-dark-border">
      <div class="flex flex-wrap items-end gap-3">
        <AgentMonitorFilterBar
          :processes="processes"
          :models="models"
          :loading="loading"
          v-model:sortBy="sortBy"
          v-model:sortAsc="sortAsc"
          @search="handleSearch"
          @process-change="handleProcessChange"
        />
      </div>
    </div>

    <!-- Charts -->
    <div v-if="sortedData.length > 0" class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Donut Chart -->
      <div class="bg-white dark:bg-dark-card rounded-xl p-4 shadow-sm border border-gray-200 dark:border-dark-border">
        <h3 class="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-2">전체 가동률</h3>
        <ResourceAgentStatusDonutChart
          :totalAgent="totalAgent"
          :totalOk="totalOk"
          :totalWarn="totalWarn"
          :totalShutdown="totalShutdown"
          :totalStopped="totalStopped"
        />
      </div>

      <!-- Bar Chart -->
      <div class="lg:col-span-2 bg-white dark:bg-dark-card rounded-xl p-4 shadow-sm border border-gray-200 dark:border-dark-border">
        <h3 class="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-2">항목별 비교</h3>
        <ResourceAgentStatusBarChart
          :data="sortedData"
          :groupByModel="groupByModel"
        />
      </div>
    </div>

    <!-- Data Table -->
    <div class="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border">
      <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-dark-border">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Agent Status</h2>
        <div v-if="sortedData.length > 0" class="relative csv-dropdown">
          <button
            @click="csvMenuOpen = !csvMenuOpen"
            class="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-border transition-colors"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            CSV
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <div
            v-if="csvMenuOpen"
            class="absolute right-0 mt-1 w-40 bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-lg shadow-lg z-10"
          >
            <button
              @click="handleCsvExport('summary')"
              class="w-full px-4 py-2 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-border rounded-t-lg"
            >
              요약
            </button>
            <button
              @click="handleCsvExport('detail')"
              :disabled="csvExporting"
              class="w-full px-4 py-2 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-border rounded-b-lg disabled:opacity-50 disabled:cursor-wait"
            >
              {{ csvExporting ? '내보내는 중...' : '상세' }}
            </button>
          </div>
        </div>
      </div>
      <div class="p-6">
        <ResourceAgentStatusTable
          :data="sortedData"
          :groupByModel="groupByModel"
          :loading="loading"
          :redisAvailable="redisAvailable"
        />
      </div>
    </div>
  </div>
</template>
