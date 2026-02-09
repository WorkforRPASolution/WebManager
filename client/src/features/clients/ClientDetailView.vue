<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '../../shared/api'
import { serviceApi } from './api'
import { useToast } from '../../shared/composables/useToast'

const route = useRoute()
const router = useRouter()
const { showError } = useToast()
const agentGroup = computed(() => route.meta.agentGroup)

const activeTab = ref('overview')
const client = ref(null)
const loading = ref(true)

const tabs = [
  { id: 'overview', label: 'Overview' },
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
