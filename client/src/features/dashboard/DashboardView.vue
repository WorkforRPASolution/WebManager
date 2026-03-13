<script setup>
import { ref, computed, onMounted } from 'vue'
import { dashboardApi } from '../../shared/api'

const stats = ref([])
const loading = ref(true)
const error = ref(null)

// Agent Status
const agentStatus = ref([])
const agentStatusLoading = ref(false)
const agentStatusError = ref(null)
const redisAvailable = ref(true)

const totalAgentCount = computed(() => agentStatus.value.reduce((sum, r) => sum + r.agentCount, 0))
const totalRunningCount = computed(() => agentStatus.value.reduce((sum, r) => sum + r.runningCount, 0))

async function fetchAgentStatus() {
  agentStatusLoading.value = true
  agentStatusError.value = null
  try {
    const response = await dashboardApi.getAgentStatus()
    agentStatus.value = response.data.data
    redisAvailable.value = response.data.redisAvailable
  } catch (err) {
    console.error('Failed to fetch agent status:', err)
    agentStatusError.value = 'Agent 상태 조회에 실패했습니다'
  } finally {
    agentStatusLoading.value = false
  }
}

onMounted(async () => {
  try {
    const response = await dashboardApi.getSummary()
    const data = response.data

    stats.value = [
      {
        label: 'ACTIVE CLIENTS',
        value: data.activeClients.toLocaleString(),
        change: `${data.activeRate}%`,
        trend: 'up',
        color: 'blue'
      },
      {
        label: 'SYSTEM UPTIME',
        value: data.uptime,
        change: '+0.1%',
        trend: 'up',
        color: 'green'
      },
      {
        label: 'ERRORS',
        value: data.errors.toString(),
        change: data.errors === 0 ? '0' : `-${data.errors}`,
        trend: 'down',
        color: 'red'
      },
      {
        label: 'TOTAL CLIENTS',
        value: data.totalClients.toLocaleString(),
        change: `${data.inactiveClients} offline`,
        trend: 'up',
        color: 'purple'
      },
    ]
  } catch (err) {
    console.error('Failed to fetch dashboard summary:', err)
    error.value = 'Failed to load dashboard data'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div>
    <!-- Header -->
    <div class="mb-8">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Dashboard Overview</h1>
      <p class="text-gray-500 dark:text-gray-400 mt-1">Monitor your system status</p>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="text-center py-12 text-gray-500">
      Loading dashboard...
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="text-center py-12 text-red-500">
      {{ error }}
    </div>

    <!-- Stats Grid -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <div
        v-for="stat in stats"
        :key="stat.label"
        class="bg-white dark:bg-dark-card rounded-xl p-6 shadow-sm border border-gray-200 dark:border-dark-border"
      >
        <div class="flex items-start justify-between">
          <div>
            <p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              {{ stat.label }}
            </p>
            <div class="mt-2 flex items-baseline">
              <p class="text-3xl font-bold text-gray-900 dark:text-white">
                {{ stat.value }}
              </p>
              <span v-if="stat.unit" class="ml-1 text-lg text-gray-500 dark:text-gray-400">
                {{ stat.unit }}
              </span>
            </div>
          </div>
          <div
            class="p-2 rounded-lg"
            :class="{
              'bg-blue-100 dark:bg-blue-900/30': stat.color === 'blue',
              'bg-green-100 dark:bg-green-900/30': stat.color === 'green',
              'bg-red-100 dark:bg-red-900/30': stat.color === 'red',
              'bg-purple-100 dark:bg-purple-900/30': stat.color === 'purple',
            }"
          >
            <svg
              class="w-6 h-6"
              :class="{
                'text-blue-500': stat.color === 'blue',
                'text-green-500': stat.color === 'green',
                'text-red-500': stat.color === 'red',
                'text-purple-500': stat.color === 'purple',
              }"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path v-if="stat.color === 'blue'" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"/>
              <path v-else-if="stat.color === 'green'" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              <path v-else-if="stat.color === 'red'" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
              <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
            </svg>
          </div>
        </div>

        <!-- Change Indicator -->
        <div class="mt-4 flex items-center">
          <span
            class="text-sm font-medium"
            :class="stat.trend === 'up' ? 'text-green-500' : 'text-red-500'"
          >
            {{ stat.change }}
          </span>
          <svg
            v-if="stat.trend"
            class="w-4 h-4 ml-1"
            :class="stat.trend === 'up' ? 'text-green-500' : 'text-red-500 rotate-180'"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18"/>
          </svg>
        </div>
      </div>
    </div>

    <!-- Agent Running Status Section -->
    <div class="mt-8 bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border">
      <div class="px-6 py-4 border-b border-gray-200 dark:border-dark-border flex items-center justify-between">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">ARS Agent Running Status</h2>
        <button
          @click="fetchAgentStatus"
          :disabled="agentStatusLoading"
          class="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <span v-if="agentStatusLoading">조회 중...</span>
          <span v-else>조회</span>
        </button>
      </div>

      <div class="p-6">
        <!-- Redis 미연결 경고 -->
        <div v-if="agentStatus.length > 0 && !redisAvailable"
          class="mb-4 px-4 py-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-sm text-yellow-700 dark:text-yellow-400">
          Redis 미연결 상태입니다. Running Count가 정확하지 않을 수 있습니다.
        </div>

        <!-- Error -->
        <div v-if="agentStatusError" class="text-center py-8 text-red-500 text-sm">
          {{ agentStatusError }}
        </div>

        <!-- Empty State -->
        <div v-else-if="agentStatus.length === 0 && !agentStatusLoading"
          class="text-center py-8 text-gray-400 dark:text-gray-500 text-sm">
          조회 버튼을 눌러 Agent 상태를 확인하세요.
        </div>

        <!-- Result Table -->
        <table v-else-if="agentStatus.length > 0" class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-200 dark:border-dark-border">
              <th class="text-left py-3 px-4 font-semibold text-gray-600 dark:text-gray-300">Process</th>
              <th class="text-right py-3 px-4 font-semibold text-gray-600 dark:text-gray-300">Agent Count</th>
              <th class="text-right py-3 px-4 font-semibold text-gray-600 dark:text-gray-300">Running Count</th>
              <th class="text-right py-3 px-4 font-semibold text-gray-600 dark:text-gray-300">Rate</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in agentStatus"
              :key="row.process"
              class="border-b border-gray-100 dark:border-dark-border/50 hover:bg-gray-50 dark:hover:bg-dark-border/30 transition-colors"
            >
              <td class="py-3 px-4 font-medium text-gray-900 dark:text-white">{{ row.process }}</td>
              <td class="py-3 px-4 text-right text-gray-700 dark:text-gray-300">{{ row.agentCount }}</td>
              <td class="py-3 px-4 text-right">
                <span :class="row.runningCount > 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-400'">
                  {{ row.runningCount }}
                </span>
              </td>
              <td class="py-3 px-4 text-right">
                <span
                  class="inline-block min-w-[3rem] text-center px-2 py-0.5 rounded-full text-xs font-medium"
                  :class="row.agentCount > 0 && row.runningCount === row.agentCount
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : row.runningCount > 0
                      ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                      : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'"
                >
                  {{ row.agentCount > 0 ? ((row.runningCount / row.agentCount) * 100).toFixed(0) + '%' : '—' }}
                </span>
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr class="border-t-2 border-gray-300 dark:border-dark-border font-semibold">
              <td class="py-3 px-4 text-gray-900 dark:text-white">Total</td>
              <td class="py-3 px-4 text-right text-gray-900 dark:text-white">{{ totalAgentCount }}</td>
              <td class="py-3 px-4 text-right text-green-600 dark:text-green-400">{{ totalRunningCount }}</td>
              <td class="py-3 px-4 text-right">
                <span class="inline-block min-w-[3rem] text-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                  {{ totalAgentCount > 0 ? ((totalRunningCount / totalAgentCount) * 100).toFixed(0) + '%' : '—' }}
                </span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  </div>
</template>
