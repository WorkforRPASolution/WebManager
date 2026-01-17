<script setup>
import { ref } from 'vue'

const alerts = ref([
  { id: 1, type: 'error', message: 'High CPU usage detected on RenderNode-09', time: '5 min ago', read: false },
  { id: 2, type: 'warning', message: 'Memory usage above 80% on Encoder-A1-05', time: '15 min ago', read: false },
  { id: 3, type: 'info', message: 'Backup completed successfully', time: '1 hour ago', read: true },
  { id: 4, type: 'error', message: 'Connection lost to Transcoder-V1-03', time: '2 hours ago', read: true },
  { id: 5, type: 'warning', message: 'Disk space running low on BackupNode-S1', time: '3 hours ago', read: true },
])

const getAlertClass = (type) => {
  switch (type) {
    case 'error': return 'bg-red-100 dark:bg-red-900/30 border-red-200 dark:border-red-800'
    case 'warning': return 'bg-yellow-100 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-800'
    case 'info': return 'bg-blue-100 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800'
    default: return 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
  }
}

const getIconClass = (type) => {
  switch (type) {
    case 'error': return 'text-red-500'
    case 'warning': return 'text-yellow-500'
    case 'info': return 'text-blue-500'
    default: return 'text-gray-500'
  }
}

const markAsRead = (alert) => {
  alert.read = true
}
</script>

<template>
  <div>
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Alerts History</h1>
      <p class="text-gray-500 dark:text-gray-400 mt-1">View and manage system alerts</p>
    </div>

    <div class="space-y-4">
      <div
        v-for="alert in alerts"
        :key="alert.id"
        class="p-4 rounded-lg border transition"
        :class="[getAlertClass(alert.type), !alert.read ? 'ring-2 ring-primary-500' : '']"
      >
        <div class="flex items-start gap-4">
          <div :class="getIconClass(alert.type)">
            <svg v-if="alert.type === 'error'" class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <svg v-else-if="alert.type === 'warning'" class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
            <svg v-else class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
          <div class="flex-1">
            <p class="text-gray-900 dark:text-white font-medium">{{ alert.message }}</p>
            <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">{{ alert.time }}</p>
          </div>
          <button
            v-if="!alert.read"
            @click="markAsRead(alert)"
            class="text-sm text-primary-500 hover:text-primary-600"
          >
            Mark as read
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
