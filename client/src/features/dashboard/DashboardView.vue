<script setup>
import { ref, onMounted } from 'vue'
import { dashboardApi } from '../../shared/api'

const stats = ref([])
const loading = ref(true)
const error = ref(null)

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
  </div>
</template>
