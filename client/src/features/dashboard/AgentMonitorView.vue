<script setup>
import { ref, onMounted, watch } from 'vue'
import { clientsApi, dashboardApi } from '../../shared/api'
import { useProcessFilterStore } from '../../shared/stores/processFilter'
import { useProcessPermission } from '../../shared/composables/useProcessPermission'
import AgentMonitorFilterBar from './components/AgentMonitorFilterBar.vue'
import AgentStatusDonutChart from './components/AgentStatusDonutChart.vue'
import AgentStatusBarChart from './components/AgentStatusBarChart.vue'
import AgentStatusTable from './components/AgentStatusTable.vue'

const processFilterStore = useProcessFilterStore()
const { buildUserProcessFilter } = useProcessPermission()

const data = ref([])
const loading = ref(false)
const redisAvailable = ref(true)
const groupByModel = ref(false)

// Filter options
const processes = ref([])
const models = ref([])

const totalAgent = ref(0)
const totalRunning = ref(0)
const totalStopped = ref(0)

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
      // process 필터 미선택 시 사용자 권한 기반 제한
      const userProcesses = buildUserProcessFilter()
      if (userProcesses) queryParams.process = userProcesses.join(',')
    }
    if (params.groupByModel) queryParams.groupByModel = 'true'
    if (params.eqpModel) queryParams.eqpModel = params.eqpModel

    const res = await dashboardApi.getAgentStatus(queryParams)
    data.value = res.data.data || []
    redisAvailable.value = res.data.redisAvailable
    groupByModel.value = !!params.groupByModel

    totalAgent.value = data.value.reduce((sum, r) => sum + r.agentCount, 0)
    totalRunning.value = data.value.reduce((sum, r) => sum + r.runningCount, 0)
    totalStopped.value = data.value.reduce((sum, r) => sum + (r.stoppedCount || 0), 0)
  } catch (err) {
    console.error('Failed to fetch agent status:', err)
    data.value = []
  } finally {
    loading.value = false
  }
}

function handleProcessChange(processes) {
  // processes: string[] | null
  const param = Array.isArray(processes) ? processes.join(',') : (processes || undefined)
  loadModels(param)
}

function handleSearch(params) {
  fetchData(params)
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
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">ARSAgent Monitor</h1>
      <p class="text-gray-500 dark:text-gray-400 mt-1">Process별 ARSAgent 가동 현황</p>
    </div>

    <!-- Filter Bar -->
    <div class="bg-white dark:bg-dark-card rounded-xl p-4 shadow-sm border border-gray-200 dark:border-dark-border">
      <AgentMonitorFilterBar
        :processes="processes"
        :models="models"
        :loading="loading"
        @search="handleSearch"
        @process-change="handleProcessChange"
      />
    </div>

    <!-- Charts -->
    <div v-if="data.length > 0" class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Donut Chart -->
      <div class="bg-white dark:bg-dark-card rounded-xl p-4 shadow-sm border border-gray-200 dark:border-dark-border">
        <h3 class="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-2">전체 가동률</h3>
        <AgentStatusDonutChart
          :totalAgent="totalAgent"
          :totalRunning="totalRunning"
          :totalStopped="totalStopped"
        />
      </div>

      <!-- Bar Chart -->
      <div class="lg:col-span-2 bg-white dark:bg-dark-card rounded-xl p-4 shadow-sm border border-gray-200 dark:border-dark-border">
        <h3 class="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-2">항목별 비교</h3>
        <AgentStatusBarChart
          :data="data"
          :groupByModel="groupByModel"
        />
      </div>
    </div>

    <!-- Data Table -->
    <div class="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border">
      <div class="px-6 py-4 border-b border-gray-200 dark:border-dark-border">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Agent Status</h2>
      </div>
      <div class="p-6">
        <AgentStatusTable
          :data="data"
          :groupByModel="groupByModel"
          :loading="loading"
          :redisAvailable="redisAvailable"
        />
      </div>
    </div>
  </div>
</template>
