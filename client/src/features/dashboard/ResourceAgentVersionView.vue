<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { clientsApi, dashboardApi } from '../../shared/api'
import { useProcessFilterStore } from '../../shared/stores/processFilter'
import { useProcessPermission } from '../../shared/composables/useProcessPermission'
import AgentMonitorFilterBar from './components/AgentMonitorFilterBar.vue'
import VersionDonutChart from './components/VersionDonutChart.vue'
import VersionBarChart from './components/VersionBarChart.vue'
import VersionGroupedTable from './components/VersionGroupedTable.vue'
import { exportResourceAgentVersionCsv, exportResourceAgentVersionDetailCsv } from './utils/csvExport'

const processFilterStore = useProcessFilterStore()
const { buildUserProcessFilter } = useProcessPermission()

const data = ref([])
const details = ref([])
const allVersions = ref([])
const loading = ref(false)
const redisAvailable = ref(true)
const groupByModel = ref(false)
const runningOnly = ref(false)
const csvMenuOpen = ref(false)

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

// Filter options
const processes = ref([])
const models = ref([])

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
    if (runningOnly.value) queryParams.runningOnly = 'true'

    const res = await dashboardApi.getResourceAgentVersionDistribution(queryParams)
    data.value = res.data.data || []
    details.value = res.data.details || []
    allVersions.value = res.data.allVersions || []
    redisAvailable.value = res.data.redisAvailable
    groupByModel.value = !!params.groupByModel
  } catch (err) {
    console.error('Failed to fetch resource agent version distribution:', err)
    data.value = []
    details.value = []
    allVersions.value = []
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

function handleRunningOnlyToggle() {
  runningOnly.value = !runningOnly.value
  fetchData(lastSearchParams)
}

function handleCsvExport(type) {
  csvMenuOpen.value = false
  if (type === 'summary') {
    exportResourceAgentVersionCsv(sortedData.value, allVersions.value, groupByModel.value)
  } else {
    exportResourceAgentVersionDetailCsv(details.value)
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
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">ResourceAgent Version</h1>
      <p class="text-gray-500 dark:text-gray-400 mt-1">Process별 ResourceAgent 버전 분포</p>
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

        <!-- Running Only Toggle -->
        <label class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer select-none mb-1.5">
          <span>Running Only</span>
          <button
            type="button"
            role="switch"
            :aria-checked="runningOnly"
            @click="handleRunningOnlyToggle"
            class="relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-dark-bg"
            :class="runningOnly ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'"
          >
            <span
              class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
              :class="runningOnly ? 'translate-x-4' : 'translate-x-0'"
            />
          </button>
        </label>
      </div>
    </div>

    <!-- Charts -->
    <div v-if="sortedData.length > 0" class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Donut Chart -->
      <div class="bg-white dark:bg-dark-card rounded-xl p-4 shadow-sm border border-gray-200 dark:border-dark-border">
        <h3 class="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-2">버전 분포</h3>
        <VersionDonutChart
          :data="sortedData"
          :allVersions="allVersions"
        />
      </div>

      <!-- Bar Chart -->
      <div class="lg:col-span-2 bg-white dark:bg-dark-card rounded-xl p-4 shadow-sm border border-gray-200 dark:border-dark-border">
        <h3 class="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-2">Process별 버전</h3>
        <VersionBarChart
          :data="sortedData"
          :allVersions="allVersions"
          :groupByModel="groupByModel"
        />
      </div>
    </div>

    <!-- Grouped Table -->
    <div class="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border">
      <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-dark-border">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Version Details</h2>
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
              class="w-full px-4 py-2 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-border rounded-b-lg"
            >
              상세
            </button>
          </div>
        </div>
      </div>
      <div class="p-6">
        <VersionGroupedTable
          :data="sortedData"
          :allVersions="allVersions"
          :groupByModel="groupByModel"
          :loading="loading"
          :redisAvailable="redisAvailable"
        />
      </div>
    </div>
  </div>
</template>
