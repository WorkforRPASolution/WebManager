<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '../../shared/api'
import { serviceApi } from './api'
import { getStatusComponent } from './components/service-status'
import { useConfigManager } from './composables/useConfigManager'
import { useToast } from '../../shared/composables/useToast'
import AppIcon from '../../shared/components/AppIcon.vue'
import ConfigManagerModal from './components/ConfigManagerModal.vue'

const route = useRoute()
const router = useRouter()
const { showSuccess, showError } = useToast()
const agentGroup = computed(() => route.meta.agentGroup)
const configManager = useConfigManager()

const activeTab = ref('overview')
const client = ref(null)
const loading = ref(true)

// Service Control State
const serviceStatus = ref(null)
const serviceStatusLoading = ref(false)
const serviceActionLoading = ref(false)
const actionMessage = ref('')

// Dynamic status component based on displayType
const StatusComponent = computed(() => getStatusComponent(client.value?.displayType))

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

onMounted(async () => {
  try {
    const response = await serviceApi.getClientById(route.params.id, agentGroup.value)
    client.value = response.data.data || response.data
  } catch (error) {
    const message = error.response?.data?.message || error.message
    showError(`Failed to load client: ${message}`)
    client.value = {
      eqpId: route.params.id,
      name: route.params.id,
      ipAddress: '',
      process: '',
      eqpModel: '',
      actions: [],
    }
  } finally {
    loading.value = false
  }
})

// Service Control Functions
const fetchServiceStatus = async () => {
  const eqpId = route.params.id
  serviceStatusLoading.value = true
  try {
    const response = await serviceApi.executeAction(eqpId, agentGroup.value, 'status')
    serviceStatus.value = response.data?.data || response.data
  } catch (error) {
    if (error.message?.includes('timeout')) {
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

const handleAction = async (action) => {
  const eqpId = route.params.id

  // Kill action requires confirmation
  if (action.name === 'kill') {
    if (!confirm(`Are you sure you want to kill the service on ${eqpId}? This will forcefully terminate the process.`)) {
      return
    }
  }

  serviceActionLoading.value = true
  actionMessage.value = `Sending ${action.label || action.name} command...`

  try {
    actionMessage.value = 'Waiting for server response...'
    const response = await serviceApi.executeAction(eqpId, agentGroup.value, action.name)

    const result = response.data?.data || response.data
    if (result.success) {
      showSuccess(result.message || `${action.label || action.name} completed`)
      actionMessage.value = 'Refreshing status...'
      await fetchServiceStatus()
    } else {
      showError(result.message || `Failed to ${action.name}`)
    }
  } catch (error) {
    if (error.message?.includes('timeout')) {
      showError('Request timeout. The server may still be processing the command.')
    } else {
      const message = error.response?.data?.message || error.message
      showError(`Failed to ${action.name}: ${message}`)
    }
  } finally {
    serviceActionLoading.value = false
    actionMessage.value = ''
  }
}

const getActionButtonClass = (action) => {
  const colorMap = {
    green: 'text-white bg-green-500 hover:bg-green-600',
    red: 'text-white bg-red-500 hover:bg-red-600',
    yellow: 'text-white bg-yellow-500 hover:bg-yellow-600',
    blue: 'text-white bg-blue-500 hover:bg-blue-600',
    gray: 'text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-dark-border hover:bg-gray-200 dark:hover:bg-gray-600',
  }
  return colorMap[action.color] || colorMap.gray
}

const isActionDisabled = (action) => {
  if (!serviceStatus.value) return false
  if (action.name === 'start' && serviceStatus.value.running) return true
  if (action.name === 'stop' && !serviceStatus.value.running) return true
  if (action.name === 'restart' && !serviceStatus.value.running) return true
  if (action.name === 'kill' && !serviceStatus.value.running) return true
  return false
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
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{{ client.eqpId }}</h1>
          <p class="text-gray-500 dark:text-gray-400 mt-1">
            {{ client.process }} &bull; {{ client.eqpModel }} &bull; {{ client.ipAddress }}
            <template v-if="client.serviceType">
              &bull; <span class="text-xs font-medium px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">{{ client.serviceType }}</span>
            </template>
          </p>
        </div>
        <div class="flex items-center gap-2">
          <span v-if="client.status" class="px-3 py-1 rounded-full text-sm font-medium"
            :class="client.status === 'online' ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'">
            {{ client.status === 'online' ? 'ON' : 'OFF' }}
          </span>
        </div>
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
    <!-- Overview Tab -->
    <div v-if="activeTab === 'overview'">
      <!-- Client Info Cards -->
      <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
        Client Information
      </h3>
      <div class="grid grid-cols-4 gap-3 mb-6">
        <div class="bg-white dark:bg-dark-card p-4 rounded-xl border border-gray-200 dark:border-dark-border">
          <span class="text-xs text-gray-500 dark:text-gray-400">EQP ID</span>
          <div class="text-lg font-bold text-gray-900 dark:text-white mt-1">{{ client.eqpId }}</div>
        </div>
        <div class="bg-white dark:bg-dark-card p-4 rounded-xl border border-gray-200 dark:border-dark-border">
          <span class="text-xs text-gray-500 dark:text-gray-400">PROCESS</span>
          <div class="text-lg font-bold text-gray-900 dark:text-white mt-1">{{ client.process || '-' }}</div>
        </div>
        <div class="bg-white dark:bg-dark-card p-4 rounded-xl border border-gray-200 dark:border-dark-border">
          <span class="text-xs text-gray-500 dark:text-gray-400">MODEL</span>
          <div class="text-lg font-bold text-gray-900 dark:text-white mt-1">{{ client.eqpModel || '-' }}</div>
        </div>
        <div class="bg-white dark:bg-dark-card p-4 rounded-xl border border-gray-200 dark:border-dark-border">
          <span class="text-xs text-gray-500 dark:text-gray-400">IP ADDRESS</span>
          <div class="text-lg font-bold text-gray-900 dark:text-white mt-1">{{ client.ipAddress || '-' }}</div>
        </div>
      </div>

      <!-- Additional Info -->
      <div class="grid grid-cols-2 gap-4">
        <div class="bg-white dark:bg-dark-card p-6 rounded-xl border border-gray-200 dark:border-dark-border">
          <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">Details</h3>
          <div class="space-y-3">
            <div class="flex justify-between">
              <span class="text-sm text-gray-500 dark:text-gray-400">Line</span>
              <span class="text-sm font-medium text-gray-900 dark:text-white">{{ client.line || '-' }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-sm text-gray-500 dark:text-gray-400">Category</span>
              <span class="text-sm font-medium text-gray-900 dark:text-white">{{ client.category || '-' }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-sm text-gray-500 dark:text-gray-400">Service Type</span>
              <span class="text-sm font-medium text-gray-900 dark:text-white">{{ client.serviceType || 'default' }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-sm text-gray-500 dark:text-gray-400">OS Version</span>
              <span class="text-sm font-medium text-gray-900 dark:text-white">{{ client.osVersion || '-' }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-sm text-gray-500 dark:text-gray-400">Install Date</span>
              <span class="text-sm font-medium text-gray-900 dark:text-white">{{ client.installDate || '-' }}</span>
            </div>
          </div>
        </div>
        <div class="bg-white dark:bg-dark-card p-6 rounded-xl border border-gray-200 dark:border-dark-border">
          <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">Status Flags</h3>
          <div class="space-y-3">
            <div class="flex justify-between">
              <span class="text-sm text-gray-500 dark:text-gray-400">On/Off</span>
              <span class="text-sm font-medium" :class="client.status === 'online' ? 'text-green-600 dark:text-green-400' : 'text-gray-500'">{{ client.status === 'online' ? 'ON' : 'OFF' }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-sm text-gray-500 dark:text-gray-400">WebManager Use</span>
              <span class="text-sm font-medium" :class="client.webmanagerUse ? 'text-green-600 dark:text-green-400' : 'text-gray-500'">{{ client.webmanagerUse ? 'YES' : 'NO' }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-sm text-gray-500 dark:text-gray-400">Local PC</span>
              <span class="text-sm font-medium text-gray-900 dark:text-white">{{ client.localPc ? 'YES' : 'NO' }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-sm text-gray-500 dark:text-gray-400">Inner IP</span>
              <span class="text-sm font-medium text-gray-900 dark:text-white">{{ client.innerIp || '-' }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Configuration Tab -->
    <div v-else-if="activeTab === 'configuration'">
      <div class="bg-white dark:bg-dark-card p-6 rounded-xl border border-gray-200 dark:border-dark-border">
        <!-- Service Control Button Group -->
        <div class="flex items-center gap-3 mb-6">
          <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mr-auto">
            Service Control
          </h3>
          <button
            @click="fetchServiceStatus"
            :disabled="serviceStatusLoading"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-dark-border rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition disabled:opacity-50"
          >
            <AppIcon name="refresh" size="4" :class="{ 'animate-spin': serviceStatusLoading }" />
            Status
          </button>
          <button
            v-for="action in (client.actions || []).filter(a => a.name !== 'status')"
            :key="action.name"
            @click="handleAction(action)"
            :disabled="serviceActionLoading || isActionDisabled(action)"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            :class="getActionButtonClass(action)"
          >
            <AppIcon :name="action.icon || 'settings'" size="4" />
            {{ action.label }}
          </button>
        </div>

        <!-- Dynamic Status Display -->
        <div class="mb-6">
          <component
            :is="StatusComponent"
            :data="serviceStatus"
            :loading="serviceStatusLoading"
          />
        </div>

        <!-- Action Loading -->
        <div v-if="serviceActionLoading" class="mb-6 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div class="flex items-center gap-2">
            <svg class="w-4 h-4 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span class="text-sm font-medium text-blue-700 dark:text-blue-300">{{ actionMessage || 'Processing...' }}</span>
          </div>
        </div>

        <!-- Divider -->
        <div class="border-t border-gray-200 dark:border-dark-border my-4"></div>

        <!-- Config Files Section -->
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Configuration Files</h3>
        </div>
        <p class="text-gray-500 dark:text-gray-400 mb-4 text-sm">
          View and edit configuration files on this client via FTP.
        </p>
        <button
          @click="openConfigManager"
          class="flex items-center gap-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white font-medium rounded-lg transition text-sm"
        >
          <AppIcon name="settings" size="4" />
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

    <!-- Logs Tab -->
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
  </div>
</template>
