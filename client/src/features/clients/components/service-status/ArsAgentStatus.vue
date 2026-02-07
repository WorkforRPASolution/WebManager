<script setup>
defineProps({
  data: { type: Object, default: null },
  loading: { type: Boolean, default: false }
})
</script>

<template>
  <div v-if="loading" class="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm">
    <svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
    </svg>
    <span>Checking status...</span>
  </div>
  <div v-else-if="data" class="p-3 rounded-lg" :class="data.running ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' : 'bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-dark-border'">
    <div class="flex items-center gap-2">
      <div class="w-2.5 h-2.5 rounded-full" :class="data.running ? 'bg-green-500 animate-pulse' : 'bg-gray-400'"></div>
      <span class="text-sm font-semibold" :class="data.running ? 'text-green-700 dark:text-green-400' : 'text-gray-700 dark:text-gray-300'">
        {{ data.state || (data.running ? 'RUNNING' : 'STOPPED') }}
      </span>
      <template v-if="data.running && data.pid">
        <span class="text-xs text-gray-500 dark:text-gray-400">PID: <span class="font-mono">{{ data.pid }}</span></span>
      </template>
    </div>
  </div>
  <div v-else class="text-sm text-gray-400 dark:text-gray-500 italic">
    Click Status to check service state
  </div>
</template>
