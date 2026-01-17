<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const activeTab = ref('overview')
const client = ref(null)
const loading = ref(true)

const tabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'configuration', label: 'Configuration' },
  { id: 'logs', label: 'Logs' },
]

const logs = ref([
  { time: '14:22:01', level: 'INFO', message: 'Connection established on port 8080' },
  { time: '14:22:05', level: 'INFO', message: 'Worker thread started (PID: 4421)' },
  { time: '14:24:12', level: 'INFO', message: 'Job #4492 assigned to worker thread' },
  { time: '14:25:00', level: 'WARN', message: 'High CPU usage detected > 75%' },
  { time: '14:25:05', level: 'INFO', message: 'Optimizing cache fragments...' },
  { time: '14:25:08', level: 'INFO', message: 'Frame 1204/2000 rendered' },
])

onMounted(() => {
  // Mock client data
  setTimeout(() => {
    client.value = {
      eqpId: route.params.id,
      name: `Client-${route.params.id}`,
      id: '884-299-AX',
      ipAddr: '10.0.0.128',
      status: 'BUSY',
      statusMessage: 'Processing job #4492 (85% complete)',
      process: 'Rendering',
      eqpModel: 'RenderNode-X1',
      resources: {
        cpu: { value: 78, status: 'High' },
        memory: { used: 12, total: 16 },
        storage: { free: 2.4, unit: 'TB' },
        latency: { value: 14, unit: 'ms' },
      }
    }
    loading.value = false
  }, 300)
})

const handleRestart = () => {
  alert('Restart service requested')
}

const handleStop = () => {
  alert('Force stop requested')
}

const getLogLevelClass = (level) => {
  switch (level) {
    case 'ERROR': return 'text-red-400'
    case 'WARN': return 'text-yellow-400'
    default: return 'text-gray-400'
  }
}
</script>

<template>
  <div v-if="loading" class="flex items-center justify-center h-64">
    <div class="text-gray-500 dark:text-gray-400">Loading...</div>
  </div>

  <div v-else-if="client">
    <!-- Header -->
    <div class="mb-6">
      <button
        @click="router.back()"
        class="mb-4 flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
        </svg>
        <span>Back to Clients</span>
      </button>

      <div class="flex items-start justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{{ client.name }}</h1>
          <p class="text-gray-500 dark:text-gray-400 mt-1">
            ID: {{ client.id }} • {{ client.ipAddr }}
          </p>
        </div>
        <div class="flex items-center gap-2">
          <span class="px-3 py-1 rounded-full text-sm font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
            {{ client.status }}
          </span>
        </div>
      </div>

      <!-- Status Message -->
      <div class="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
        <div class="flex items-center gap-2">
          <div class="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
          <span class="text-blue-700 dark:text-blue-300 font-medium">STATUS: {{ client.status }}</span>
        </div>
        <p class="mt-1 text-blue-600 dark:text-blue-400">{{ client.statusMessage }}</p>
      </div>
    </div>

    <!-- Tabs -->
    <div class="border-b border-gray-200 dark:border-dark-border mb-6">
      <nav class="flex gap-8">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          @click="activeTab = tab.id"
          class="pb-4 text-sm font-medium border-b-2 transition"
          :class="activeTab === tab.id
            ? 'border-primary-500 text-primary-500'
            : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'"
        >
          {{ tab.label }}
        </button>
      </nav>
    </div>

    <!-- Tab Content -->
    <div v-if="activeTab === 'overview'">
      <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
        System Resources
      </h3>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- CPU -->
        <div class="bg-white dark:bg-dark-card p-6 rounded-xl border border-gray-200 dark:border-dark-border">
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm text-gray-500 dark:text-gray-400">CPU LOAD</span>
            <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"/>
            </svg>
          </div>
          <div class="flex items-baseline gap-2">
            <span class="text-3xl font-bold text-gray-900 dark:text-white">{{ client.resources.cpu.value }}%</span>
            <span class="text-sm text-yellow-500 font-medium">{{ client.resources.cpu.status }}</span>
          </div>
          <div class="mt-3 h-2 bg-gray-200 dark:bg-dark-border rounded-full overflow-hidden">
            <div
              class="h-full rounded-full transition-all"
              :class="client.resources.cpu.value > 75 ? 'bg-yellow-500' : 'bg-green-500'"
              :style="{ width: `${client.resources.cpu.value}%` }"
            ></div>
          </div>
        </div>

        <!-- Memory -->
        <div class="bg-white dark:bg-dark-card p-6 rounded-xl border border-gray-200 dark:border-dark-border">
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm text-gray-500 dark:text-gray-400">MEMORY</span>
            <svg class="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
            </svg>
          </div>
          <div class="flex items-baseline gap-2">
            <span class="text-3xl font-bold text-gray-900 dark:text-white">{{ client.resources.memory.used }}</span>
            <span class="text-lg text-gray-500 dark:text-gray-400">/ {{ client.resources.memory.total }} GB</span>
          </div>
          <div class="mt-3 h-2 bg-gray-200 dark:bg-dark-border rounded-full overflow-hidden">
            <div
              class="h-full bg-purple-500 rounded-full transition-all"
              :style="{ width: `${(client.resources.memory.used / client.resources.memory.total) * 100}%` }"
            ></div>
          </div>
        </div>

        <!-- Storage -->
        <div class="bg-white dark:bg-dark-card p-6 rounded-xl border border-gray-200 dark:border-dark-border">
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm text-gray-500 dark:text-gray-400">STORAGE</span>
            <svg class="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"/>
            </svg>
          </div>
          <div class="flex items-baseline gap-2">
            <span class="text-3xl font-bold text-gray-900 dark:text-white">{{ client.resources.storage.free }}</span>
            <span class="text-lg text-gray-500 dark:text-gray-400">{{ client.resources.storage.unit }} Free</span>
          </div>
        </div>

        <!-- Latency -->
        <div class="bg-white dark:bg-dark-card p-6 rounded-xl border border-gray-200 dark:border-dark-border">
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm text-gray-500 dark:text-gray-400">LATENCY</span>
            <svg class="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
            </svg>
          </div>
          <div class="flex items-baseline gap-2">
            <span class="text-3xl font-bold text-gray-900 dark:text-white">{{ client.resources.latency.value }}</span>
            <span class="text-lg text-gray-500 dark:text-gray-400">{{ client.resources.latency.unit }}</span>
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="activeTab === 'configuration'">
      <div class="bg-white dark:bg-dark-card p-6 rounded-xl border border-gray-200 dark:border-dark-border">
        <p class="text-gray-500 dark:text-gray-400">Configuration settings will be available here.</p>
      </div>
    </div>

    <div v-else-if="activeTab === 'logs'">
      <div class="bg-white dark:bg-dark-card rounded-xl border border-gray-200 dark:border-dark-border overflow-hidden">
        <div class="p-4 border-b border-gray-200 dark:border-dark-border flex items-center justify-between">
          <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Live Log Stream
          </h3>
          <button class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
            </svg>
          </button>
        </div>
        <div class="bg-gray-900 p-4 font-mono text-sm max-h-96 overflow-y-auto">
          <div v-for="(log, index) in logs" :key="index" class="py-1">
            <span class="text-gray-500">{{ log.time }}</span>
            <span :class="getLogLevelClass(log.level)" class="mx-2">[{{ log.level }}]</span>
            <span class="text-gray-300">{{ log.message }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Action Buttons -->
    <div class="mt-6 flex gap-4">
      <button
        @click="handleStop"
        class="flex-1 py-3 px-4 bg-gray-200 dark:bg-dark-border text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition flex items-center justify-center gap-2"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"/>
        </svg>
        Force Stop
      </button>
      <button
        @click="handleRestart"
        class="flex-1 py-3 px-4 bg-primary-500 text-white font-medium rounded-lg hover:bg-primary-600 transition flex items-center justify-center gap-2"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
        </svg>
        Restart Service
      </button>
    </div>
  </div>
</template>
