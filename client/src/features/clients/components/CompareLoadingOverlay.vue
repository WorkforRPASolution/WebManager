<template>
  <div class="flex flex-col items-center justify-center gap-4 py-12">
    <div class="text-sm font-medium text-gray-700 dark:text-gray-300">
      Loading configs... {{ progress.loaded + progress.failed }} / {{ progress.total }}
    </div>

    <!-- Progress bar -->
    <div class="w-80 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
      <div
        class="h-full bg-primary-500 transition-all duration-300"
        :style="{ width: `${percent}%` }"
      ></div>
    </div>

    <!-- Per-client status -->
    <div class="flex flex-wrap gap-2 max-w-lg justify-center">
      <span
        v-for="eqpId in eqpIds"
        :key="eqpId"
        :class="[
          'px-2 py-0.5 rounded text-xs font-mono',
          statusClass(loadingStatus[eqpId])
        ]"
      >
        {{ eqpId }}
      </span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  eqpIds: { type: Array, required: true },
  loadingStatus: { type: Object, required: true },
  progress: { type: Object, required: true }
})

const percent = computed(() => {
  if (props.progress.total === 0) return 0
  return Math.round(((props.progress.loaded + props.progress.failed) / props.progress.total) * 100)
})

function statusClass(status) {
  switch (status) {
    case 'loaded': return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
    case 'error': return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
    default: return 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
  }
}
</script>
