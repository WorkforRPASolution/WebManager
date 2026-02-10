<template>
  <div class="border-b border-gray-200 dark:border-dark-border shrink-0" :class="collapsed ? 'h-8' : 'h-48'">
    <!-- Header -->
    <div class="flex items-center justify-between px-3 py-1 bg-gray-100 dark:bg-dark-bg border-b border-gray-200 dark:border-dark-border">
      <div class="flex items-center gap-2">
        <button @click="collapsed = !collapsed" class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
          <svg class="w-3.5 h-3.5 transition-transform" :class="collapsed ? '-rotate-90' : ''" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <span class="text-xs font-medium text-gray-600 dark:text-gray-400">Files ({{ validFiles.length }})</span>
      </div>
      <div v-if="!collapsed" class="flex items-center gap-1">
        <button
          v-if="selectedFiles.size > 0"
          @click="$emit('delete-selected')"
          class="px-2 py-0.5 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition"
        >
          Delete ({{ selectedFiles.size }})
        </button>
        <button
          v-if="selectedFiles.size > 0"
          @click="$emit('tail-selected')"
          class="px-2 py-0.5 text-xs text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition"
        >
          Tail ({{ selectedFiles.size }})
        </button>
      </div>
    </div>

    <!-- File list -->
    <div v-if="!collapsed" class="overflow-y-auto" style="height: calc(100% - 28px)">
      <!-- Loading -->
      <div v-if="loading" class="flex items-center justify-center py-4">
        <svg class="w-5 h-5 animate-spin text-primary-500" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>

      <!-- Error -->
      <div v-else-if="error" class="px-3 py-4 text-center text-sm text-red-500">{{ error }}</div>

      <!-- Empty -->
      <div v-else-if="files.length === 0" class="px-3 py-4 text-center text-sm text-gray-400">No log files found</div>

      <!-- File rows -->
      <div v-else>
        <!-- Select all row -->
        <div class="flex items-center gap-2 px-3 py-1 border-b border-gray-100 dark:border-dark-border bg-gray-50 dark:bg-dark-bg">
          <input
            type="checkbox"
            :checked="allSelected"
            @change="$emit('select-all', $event.target.checked)"
            class="w-3.5 h-3.5 rounded border-gray-300 text-primary-500 focus:ring-primary-500"
          />
          <span class="text-xs text-gray-400">Select All</span>
        </div>

        <div
          v-for="file in validFiles"
          :key="file.path"
          class="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-dark-hover border-b border-gray-100 dark:border-gray-800 text-sm"
        >
          <!-- Checkbox -->
          <input
            type="checkbox"
            :checked="selectedFiles.has(file.path)"
            @change="$emit('toggle-select', file.path)"
            class="w-3.5 h-3.5 rounded border-gray-300 text-primary-500 focus:ring-primary-500 shrink-0"
          />

          <!-- File name (clickable) -->
          <button
            @click="$emit('file-click', file)"
            class="flex-1 text-left text-primary-600 dark:text-primary-400 hover:underline truncate font-mono text-xs"
          >
            {{ file.name }}
          </button>

          <!-- Size -->
          <span class="text-xs text-gray-400 shrink-0 w-16 text-right">{{ formatSize(file.size) }}</span>

          <!-- Date -->
          <span class="text-xs text-gray-400 shrink-0 w-28 text-right">{{ formatDate(file.modifiedAt) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  files: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  error: { type: String, default: null },
  selectedFiles: { type: Set, default: () => new Set() },
  tailingFiles: { type: Set, default: () => new Set() }
})

defineEmits(['file-click', 'toggle-select', 'select-all', 'delete-selected', 'tail-selected'])

const collapsed = ref(false)

const validFiles = computed(() => props.files.filter(f => !f.error))

const allSelected = computed(() => {
  if (validFiles.value.length === 0) return false
  return validFiles.value.every(f => props.selectedFiles.has(f.path))
})

function formatSize(bytes) {
  if (!bytes && bytes !== 0) return '-'
  if (bytes < 1024) return bytes + 'B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB'
  return (bytes / (1024 * 1024)).toFixed(1) + 'MB'
}

function formatDate(dateStr) {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
</script>
