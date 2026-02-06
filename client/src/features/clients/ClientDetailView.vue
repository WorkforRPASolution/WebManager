<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { clientControlApi } from './api'
import { useConfigManager } from './composables/useConfigManager'
import { useToast } from '../../shared/composables/useToast'
import ConfigManagerModal from './components/ConfigManagerModal.vue'

const route = useRoute()
const router = useRouter()
const { showSuccess, showError } = useToast()
const configManager = useConfigManager()

const activeTab = ref('overview')
const client = ref(null)
const loading = ref(true)

// Service Control State
const serviceStatus = ref(null)
const serviceStatusLoading = ref(false)
const serviceActionLoading = ref(false)
const actionMessage = ref('')

// Timeout utility for API calls
const withTimeout = (promise, ms = 30000) => {
  const timeout = new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Request timeout after ${ms / 1000}s`)), ms)
  })
  return Promise.race([promise, timeout])
}

const tabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'control', label: 'Service Control' },
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

// Service Control Functions
const fetchServiceStatus = async () => {
  const eqpId = route.params.id
  serviceStatusLoading.value = true
  try {
    const response = await withTimeout(clientControlApi.getStatus(eqpId), 30000)
    serviceStatus.value = response.data
  } catch (error) {
    if (error.message.includes('timeout')) {
      showError('Status request timeout. The client may be unreachable.')
    } else {
      const message = error.response?.data?.message || error.message
      showError(`Failed to get status: ${message}`)
    }
    serviceStatus.value = null
  } finally {
    serviceStatusLoading.value = false
  }
}

const handleStart = async () => {
  const eqpId = route.params.id
  serviceActionLoading.value = true
  actionMessage.value = 'Sending start command...'

  try {
    actionMessage.value = 'Waiting for server response...'
    const response = await withTimeout(clientControlApi.start(eqpId), 30000)

    if (response.data.success) {
      showSuccess(response.data.message || 'Service started')
      actionMessage.value = 'Refreshing status...'
      await fetchServiceStatus()
    } else {
      showError(response.data.message || 'Failed to start service')
    }
  } catch (error) {
    if (error.message.includes('timeout')) {
      showError('Request timeout. The server may still be processing the command.')
    } else {
      const message = error.response?.data?.message || error.message
      showError(`Failed to start: ${message}`)
    }
  } finally {
    serviceActionLoading.value = false
    actionMessage.value = ''
  }
}

const handleStop = async () => {
  const eqpId = route.params.id
  serviceActionLoading.value = true
  actionMessage.value = 'Sending stop command...'

  try {
    actionMessage.value = 'Waiting for server response...'
    const response = await withTimeout(clientControlApi.stop(eqpId), 30000)

    if (response.data.success) {
      showSuccess(response.data.message || 'Service stopped')
      actionMessage.value = 'Refreshing status...'
      await fetchServiceStatus()
    } else {
      showError(response.data.message || 'Failed to stop service')
    }
  } catch (error) {
    if (error.message.includes('timeout')) {
      showError('Request timeout. The server may still be processing the command.')
    } else {
      const message = error.response?.data?.message || error.message
      showError(`Failed to stop: ${message}`)
    }
  } finally {
    serviceActionLoading.value = false
    actionMessage.value = ''
  }
}

const handleRestart = async () => {
  const eqpId = route.params.id
  serviceActionLoading.value = true
  actionMessage.value = 'Sending restart command...'

  try {
    actionMessage.value = 'Waiting for server response...'
    const response = await withTimeout(clientControlApi.restart(eqpId), 30000)

    if (response.data.success) {
      showSuccess(response.data.message || 'Service restarted')
      actionMessage.value = 'Refreshing status...'
      await fetchServiceStatus()
    } else {
      showError(response.data.message || 'Failed to restart service')
    }
  } catch (error) {
    if (error.message.includes('timeout')) {
      showError('Request timeout. The server may still be processing the command.')
    } else {
      const message = error.response?.data?.message || error.message
      showError(`Failed to restart: ${message}`)
    }
  } finally {
    serviceActionLoading.value = false
    actionMessage.value = ''
  }
}

// Config Management
const openConfigManager = () => {
  if (client.value) {
    configManager.openConfig(client.value)
  }
}

const handleConfigSave = async () => {
  const result = await configManager.saveCurrentFile()
  if (result?.success) {
    showSuccess('Config saved successfully')
  } else if (result?.error) {
    showError(result.error)
  }
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

    <!-- Service Control Tab -->
    <div v-else-if="activeTab === 'control'">
      <div class="bg-white dark:bg-dark-card p-6 rounded-xl border border-gray-200 dark:border-dark-border">
        <div class="flex items-center justify-between mb-6">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Service Control</h3>
          <button
            @click="fetchServiceStatus"
            :disabled="serviceStatusLoading"
            class="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-300 dark:border-dark-border rounded-lg hover:bg-gray-50 dark:hover:bg-dark-border transition disabled:opacity-50"
          >
            <svg class="w-4 h-4" :class="{ 'animate-spin': serviceStatusLoading }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
            Refresh
          </button>
        </div>

        <!-- Status Display -->
        <div class="mb-6 p-4 rounded-lg" :class="serviceStatus?.running ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' : 'bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-dark-border'">
          <div v-if="serviceStatusLoading" class="flex items-center gap-2 text-gray-500 dark:text-gray-400">
            <svg class="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
            <span>Checking status...</span>
          </div>
          <div v-else-if="serviceStatus === null" class="text-gray-500 dark:text-gray-400">
            <p>Click "Refresh" to check service status</p>
          </div>
          <div v-else>
            <div class="flex items-center gap-3">
              <div class="w-3 h-3 rounded-full" :class="serviceStatus.running ? 'bg-green-500 animate-pulse' : 'bg-gray-400'"></div>
              <span class="text-lg font-semibold" :class="serviceStatus.running ? 'text-green-700 dark:text-green-400' : 'text-gray-700 dark:text-gray-300'">
                {{ serviceStatus.running ? 'Running' : 'Stopped' }}
              </span>
            </div>
            <div v-if="serviceStatus.running" class="mt-2 grid grid-cols-2 gap-4 text-sm">
              <div>
                <span class="text-gray-500 dark:text-gray-400">PID:</span>
                <span class="ml-2 font-mono text-gray-900 dark:text-white">{{ serviceStatus.pid }}</span>
              </div>
              <div v-if="serviceStatus.uptime">
                <span class="text-gray-500 dark:text-gray-400">Uptime:</span>
                <span class="ml-2 font-mono text-gray-900 dark:text-white">{{ serviceStatus.uptime }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Control Buttons -->
        <div class="flex gap-3">
          <button
            @click="handleStart"
            :disabled="serviceActionLoading || serviceStatus?.running"
            class="flex-1 py-2.5 px-4 bg-green-500 text-white font-medium rounded-lg hover:bg-green-600 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            Start
          </button>
          <button
            @click="handleStop"
            :disabled="serviceActionLoading || !serviceStatus?.running"
            class="flex-1 py-2.5 px-4 bg-red-500 text-white font-medium rounded-lg hover:bg-red-600 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"/>
            </svg>
            Stop
          </button>
          <button
            @click="handleRestart"
            :disabled="serviceActionLoading || !serviceStatus?.running"
            class="flex-1 py-2.5 px-4 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
            Restart
          </button>
        </div>

        <!-- Loading Overlay with detailed message -->
        <div v-if="serviceActionLoading" class="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div class="flex items-center gap-3">
            <svg class="w-5 h-5 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <div>
              <p class="font-medium text-blue-700 dark:text-blue-300">{{ actionMessage || 'Processing...' }}</p>
              <p class="text-sm text-blue-600 dark:text-blue-400">Please wait for the server response</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="activeTab === 'configuration'">
      <div class="bg-white dark:bg-dark-card p-6 rounded-xl border border-gray-200 dark:border-dark-border">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Configuration Files</h3>
        </div>
        <p class="text-gray-500 dark:text-gray-400 mb-4">
          View and edit configuration files on this client via FTP.
        </p>
        <button
          @click="openConfigManager"
          class="flex items-center gap-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white font-medium rounded-lg transition"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Open Config Manager
        </button>
      </div>

      <!-- Config Manager Modal -->
      <ConfigManagerModal
        :is-open="configManager.isOpen.value"
        :source-client="configManager.sourceClient.value"
        :config-files="configManager.configFiles.value"
        :active-file-id="configManager.activeFileId.value"
        :edited-contents="configManager.editedContents.value"
        :original-contents="configManager.originalContents.value"
        :loading="configManager.loading.value"
        :saving="configManager.saving.value"
        :show-diff="configManager.showDiff.value"
        :show-rollout="configManager.showRollout.value"
        :error="configManager.error.value"
        :active-file="configManager.activeFile.value"
        :active-content="configManager.activeContent.value"
        :active-original-content="configManager.activeOriginalContent.value"
        :has-changes="configManager.hasChanges.value"
        :active-file-has-changes="configManager.activeFileHasChanges.value"
        :changed-file-ids="configManager.changedFileIds.value"
        :global-error="configManager.error.value"
        @close="configManager.closeConfig()"
        @select-file="configManager.selectFile($event)"
        @update-content="configManager.updateContent($event)"
        @save="handleConfigSave"
        @toggle-diff="configManager.toggleDiff()"
        @toggle-rollout="configManager.toggleRollout()"
      />
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

    <!-- Quick Action Buttons -->
    <div class="mt-6 flex gap-4">
      <button
        @click="handleStop"
        :disabled="serviceActionLoading"
        class="flex-1 py-3 px-4 bg-gray-200 dark:bg-dark-border text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition flex items-center justify-center gap-2 disabled:opacity-50"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"/>
        </svg>
        Stop Service
      </button>
      <button
        @click="handleRestart"
        :disabled="serviceActionLoading"
        class="flex-1 py-3 px-4 bg-primary-500 text-white font-medium rounded-lg hover:bg-primary-600 transition flex items-center justify-center gap-2 disabled:opacity-50"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
        </svg>
        Restart Service
      </button>
    </div>
  </div>
</template>
