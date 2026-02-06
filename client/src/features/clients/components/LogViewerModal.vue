<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  clientName: {
    type: String,
    default: ''
  },
  eqpId: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['close'])

// Mock logs - same as ClientDetailView
const logs = ref([
  { time: '14:22:01', level: 'INFO', message: 'Connection established on port 8080' },
  { time: '14:22:05', level: 'INFO', message: 'Worker thread started (PID: 4421)' },
  { time: '14:24:12', level: 'INFO', message: 'Job #4492 assigned to worker thread' },
  { time: '14:25:00', level: 'WARN', message: 'High CPU usage detected > 75%' },
  { time: '14:25:05', level: 'INFO', message: 'Optimizing cache fragments...' },
  { time: '14:25:08', level: 'INFO', message: 'Frame 1204/2000 rendered' },
])

const getLogLevelClass = (level) => {
  switch (level) {
    case 'ERROR': return 'text-red-400'
    case 'WARN': return 'text-yellow-400'
    default: return 'text-gray-400'
  }
}

const handleClose = () => {
  emit('close')
}

const handleBackdropClick = (e) => {
  if (e.target === e.currentTarget) {
    handleClose()
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-150"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isOpen"
        class="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
        @mousedown="handleBackdropClick"
      >
        <div class="bg-white dark:bg-dark-card rounded-xl shadow-2xl border border-gray-200 dark:border-dark-border w-[800px] max-h-[80vh] flex flex-col">
          <!-- Header -->
          <div class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-dark-border">
            <div>
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Log Viewer</h2>
              <p class="text-sm text-gray-500 dark:text-gray-400">{{ clientName || eqpId }}</p>
            </div>
            <button
              @click="handleClose"
              class="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>

          <!-- Log Content -->
          <div class="flex-1 overflow-hidden">
            <div class="bg-gray-900 p-4 font-mono text-sm h-full max-h-[60vh] overflow-y-auto">
              <div v-for="(log, index) in logs" :key="index" class="py-1">
                <span class="text-gray-500">{{ log.time }}</span>
                <span :class="getLogLevelClass(log.level)" class="mx-2">[{{ log.level }}]</span>
                <span class="text-gray-300">{{ log.message }}</span>
              </div>
              <div v-if="!logs.length" class="text-gray-500 text-center py-8">
                No logs available
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="p-3 border-t border-gray-200 dark:border-dark-border flex justify-end">
            <button
              @click="handleClose"
              class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-dark-border rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
