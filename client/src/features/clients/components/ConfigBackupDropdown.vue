<template>
  <div class="relative" ref="dropdownRef">
    <button
      @click="toggle"
      :disabled="disabled"
      :class="[
        'flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded transition',
        isOpen
          ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700',
        'disabled:opacity-50 disabled:cursor-not-allowed'
      ]"
      title="Restore from backup"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      Backup
    </button>

    <!-- Dropdown Panel -->
    <div
      v-if="isOpen"
      class="absolute right-0 top-full mt-1 w-72 bg-white dark:bg-dark-card rounded-lg shadow-xl border border-gray-200 dark:border-dark-border z-50 overflow-hidden"
    >
      <div class="px-3 py-2 border-b border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg">
        <span class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Backup History</span>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="flex items-center justify-center py-6">
        <svg class="w-5 h-5 animate-spin text-primary-500" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>

      <!-- Error -->
      <div v-else-if="error" class="px-3 py-4 text-center">
        <p class="text-sm text-red-500">{{ error }}</p>
      </div>

      <!-- Empty -->
      <div v-else-if="backups.length === 0" class="px-3 py-4 text-center">
        <p class="text-sm text-gray-500 dark:text-gray-400">No backups available</p>
      </div>

      <!-- Backup List -->
      <div v-else class="max-h-64 overflow-y-auto">
        <button
          v-for="backup in backups"
          :key="backup.name"
          @click="handleRestore(backup.name)"
          class="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-dark-hover transition-colors border-b border-gray-100 dark:border-gray-800 last:border-b-0"
        >
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-700 dark:text-gray-300 font-mono">
              {{ formatTimestamp(backup.timestamp) }}
            </span>
            <span class="text-xs text-gray-400">{{ formatSize(backup.size) }}</span>
          </div>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  backups: { type: Array, default: () => [] },
  loading: Boolean,
  error: String,
  disabled: Boolean
})

const emit = defineEmits(['load-backups', 'restore-backup'])

const dropdownRef = ref(null)
const isOpen = ref(false)

function toggle() {
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    emit('load-backups')
  }
}

function handleRestore(backupName) {
  emit('restore-backup', backupName)
  isOpen.value = false
}

function formatTimestamp(raw) {
  if (!raw || raw.length < 15) return raw
  // YYYYMMDD_HHmmss → YYYY-MM-DD HH:mm:ss
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)} ${raw.slice(9, 11)}:${raw.slice(11, 13)}:${raw.slice(13, 15)}`
}

function formatSize(bytes) {
  if (bytes == null) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

function handleClickOutside(e) {
  if (dropdownRef.value && !dropdownRef.value.contains(e.target)) {
    isOpen.value = false
  }
}

onMounted(() => document.addEventListener('mousedown', handleClickOutside))
onUnmounted(() => document.removeEventListener('mousedown', handleClickOutside))
</script>
