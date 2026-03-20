<script setup>
import { ref, onMounted } from 'vue'
import { clientsApi, userActivityApi } from '../../../shared/api'
import { useProcessFilterStore } from '../../../shared/stores/processFilter'
import { useProcessPermission } from '../../../shared/composables/useProcessPermission'
import { useToast } from '../../../shared/composables/useToast'
import UserActivityFilterBar from './UserActivityFilterBar.vue'
import UserActivityKPICards from './UserActivityKPICards.vue'
import UserActivityDonutChart from './UserActivityDonutChart.vue'
import UserActivityTopUsersChart from './UserActivityTopUsersChart.vue'
import UserActivityProcessChart from './UserActivityProcessChart.vue'
import UserActivityRecentTable from './UserActivityRecentTable.vue'

const { showError } = useToast()
const processFilterStore = useProcessFilterStore()
const { buildUserProcessFilter } = useProcessPermission()

const loading = ref(false)
const data = ref(null)
const processes = ref([])

async function fetchData(filters = { period: 'all' }) {
  loading.value = true
  try {
    const queryFilters = { ...filters }
    if (!queryFilters.process) {
      const userProcesses = buildUserProcessFilter()
      if (userProcesses) queryFilters.process = userProcesses.join(',')
    }
    const res = await userActivityApi.getToolUsage(queryFilters)
    data.value = res.data
  } catch (err) {
    showError('데이터 로드에 실패했습니다')
    console.error('User activity fetch error:', err)
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

onMounted(() => {
  loadFilterOptions()
  fetchData()
})
</script>

<template>
  <div class="p-6 space-y-6">
    <!-- Filter Bar -->
    <UserActivityFilterBar
      :processes="processes"
      :loading="loading"
      @search="handleSearch"
    />

    <!-- Loading Skeleton -->
    <div v-if="loading && !data" class="space-y-6">
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div v-for="i in 4" :key="i" class="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border p-4 animate-pulse">
          <div class="h-3 bg-gray-200 dark:bg-gray-700 rounded w-20 mb-2"></div>
          <div class="h-7 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
        </div>
      </div>
    </div>

    <!-- Data Content -->
    <template v-if="data">
      <!-- KPI Cards -->
      <UserActivityKPICards :kpi="data.kpi" />

      <!-- Process Chart (2/3) + Donut (1/3) -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="lg:col-span-2 bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border p-4">
          <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">공정별 사용 현황</h3>
          <UserActivityProcessChart :data="data.processSummary || []" />
        </div>
        <div class="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border p-4">
          <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">사용자 분포</h3>
          <UserActivityDonutChart
            :activeUsers="data.kpi?.activeUsers || 0"
            :totalUsers="data.kpi?.totalUsers || 0"
            :usageRate="data.kpi?.usageRate || 0"
          />
        </div>
      </div>

      <!-- Top 10 + Recent Users (side by side) -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Left: Top 10 (누적 실행 횟수 순) -->
        <div class="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border p-4">
          <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            Top 10 — 누적 실행 횟수
            <span class="ml-1.5 text-xs font-normal text-gray-400 dark:text-gray-500">accessnum 기준</span>
          </h3>
          <UserActivityTopUsersChart :data="data.topUsers || []" />
        </div>

        <!-- Right: 최근 접속 순 -->
        <div class="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border p-4">
          <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            최근 실행 사용자
            <span class="ml-1.5 text-xs font-normal text-gray-400 dark:text-gray-500">최근 SE 실행 시간 역순</span>
          </h3>
          <UserActivityRecentTable :data="data.recentUsers || []" />
        </div>
      </div>
    </template>
  </div>
</template>
