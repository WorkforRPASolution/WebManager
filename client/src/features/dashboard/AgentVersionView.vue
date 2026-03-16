<script setup>
import { ref, onMounted } from 'vue'
import { clientsApi, dashboardApi } from '../../shared/api'
import { useProcessFilterStore } from '../../shared/stores/processFilter'
import { useProcessPermission } from '../../shared/composables/useProcessPermission'
import AgentMonitorFilterBar from './components/AgentMonitorFilterBar.vue'
import VersionDonutChart from './components/VersionDonutChart.vue'
import VersionBarChart from './components/VersionBarChart.vue'
import VersionGroupedTable from './components/VersionGroupedTable.vue'

const processFilterStore = useProcessFilterStore()
const { buildUserProcessFilter } = useProcessPermission()

const data = ref([])
const allVersions = ref([])
const loading = ref(false)
const redisAvailable = ref(true)
const groupByModel = ref(false)
const runningOnly = ref(false)

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

    const res = await dashboardApi.getAgentVersionDistribution(queryParams)
    data.value = res.data.data || []
    allVersions.value = res.data.allVersions || []
    redisAvailable.value = res.data.redisAvailable
    groupByModel.value = !!params.groupByModel
  } catch (err) {
    console.error('Failed to fetch version distribution:', err)
    data.value = []
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

onMounted(() => {
  loadProcesses()
  fetchData()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div>
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">ARSAgent Version</h1>
      <p class="text-gray-500 dark:text-gray-400 mt-1">Process별 ARSAgent 버전 분포</p>
    </div>

    <!-- Filter Bar -->
    <div class="bg-white dark:bg-dark-card rounded-xl p-4 shadow-sm border border-gray-200 dark:border-dark-border">
      <div class="flex flex-wrap items-center gap-3">
        <AgentMonitorFilterBar
          :processes="processes"
          :models="models"
          :loading="loading"
          @search="handleSearch"
          @process-change="handleProcessChange"
        />

        <!-- Running Only Toggle -->
        <label class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer select-none">
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
    <div v-if="data.length > 0" class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Donut Chart -->
      <div class="bg-white dark:bg-dark-card rounded-xl p-4 shadow-sm border border-gray-200 dark:border-dark-border">
        <h3 class="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-2">버전 분포</h3>
        <VersionDonutChart
          :data="data"
          :allVersions="allVersions"
        />
      </div>

      <!-- Bar Chart -->
      <div class="lg:col-span-2 bg-white dark:bg-dark-card rounded-xl p-4 shadow-sm border border-gray-200 dark:border-dark-border">
        <h3 class="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-2">Process별 버전</h3>
        <VersionBarChart
          :data="data"
          :allVersions="allVersions"
          :groupByModel="groupByModel"
        />
      </div>
    </div>

    <!-- Grouped Table -->
    <div class="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border">
      <div class="px-6 py-4 border-b border-gray-200 dark:border-dark-border">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Version Details</h2>
      </div>
      <div class="p-6">
        <VersionGroupedTable
          :data="data"
          :allVersions="allVersions"
          :groupByModel="groupByModel"
          :loading="loading"
          :redisAvailable="redisAvailable"
        />
      </div>
    </div>
  </div>
</template>
