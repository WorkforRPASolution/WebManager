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
    <span>Loading...</span>
  </div>
  <div v-else-if="data" class="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-dark-border">
    <div class="grid grid-cols-2 gap-2 text-sm">
      <template v-for="(value, key) in data" :key="key">
        <span class="text-gray-500 dark:text-gray-400">{{ key }}</span>
        <span class="text-gray-900 dark:text-white font-mono">{{ value }}</span>
      </template>
    </div>
  </div>
  <div v-else class="text-sm text-gray-400 dark:text-gray-500 italic">
    No status data available
  </div>
</template>
