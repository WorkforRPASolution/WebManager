<template>
  <div class="space-y-3">
    <!-- Progress Bar -->
    <div>
      <div class="flex items-center justify-between text-sm mb-1">
        <span class="text-gray-700 dark:text-gray-300 font-medium">
          {{ deploying ? 'Deploying...' : deployResult ? 'Complete' : 'Ready' }}
        </span>
        <span class="text-gray-500 dark:text-gray-400">
          {{ progress.completed }} / {{ progress.total }}
        </span>
      </div>
      <div class="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          class="h-full rounded-full transition-all duration-300"
          :class="deployResult?.error ? 'bg-red-500' : 'bg-green-500'"
          :style="{ width: `${progressPercent}%` }"
        ></div>
      </div>
    </div>

    <!-- Results Summary -->
    <div v-if="deployResult" class="flex items-center gap-4 text-sm">
      <span class="flex items-center gap-1 text-green-600 dark:text-green-400">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
        </svg>
        {{ deployResult.success }} succeeded
      </span>
      <span v-if="deployResult.failed > 0" class="flex items-center gap-1 text-red-600 dark:text-red-400">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
        {{ deployResult.failed }} failed
      </span>
    </div>

    <!-- Individual Results -->
    <div v-if="clientResults.length > 0" class="max-h-40 overflow-y-auto space-y-1">
      <div
        v-for="result in clientResults"
        :key="result.eqpId"
        class="flex items-center justify-between px-2 py-1 rounded text-xs"
        :class="result.status === 'success'
          ? 'bg-green-50 dark:bg-green-900/20'
          : result.status === 'error'
            ? 'bg-red-50 dark:bg-red-900/20'
            : 'bg-gray-50 dark:bg-gray-800'"
      >
        <span class="font-mono text-gray-700 dark:text-gray-300">{{ result.eqpId }}</span>
        <span :class="result.status === 'success' ? 'text-green-600 dark:text-green-400' : result.status === 'error' ? 'text-red-600 dark:text-red-400' : 'text-gray-400'">
          {{ result.status === 'success' ? 'OK' : result.status === 'error' ? result.error : 'Pending' }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  deploying: Boolean,
  progress: {
    type: Object,
    default: () => ({ completed: 0, total: 0 })
  },
  deployResult: Object,
  clientResults: {
    type: Array,
    default: () => []
  }
})

const progressPercent = computed(() => {
  if (props.progress.total === 0) return 0
  return Math.round((props.progress.completed / props.progress.total) * 100)
})
</script>
