<script setup>
import { computed } from 'vue'

const props = defineProps({
  data: { type: Object, default: null },
  loading: { type: Boolean, default: false }
})

const stateConfig = computed(() => {
  if (!props.data) return null
  const state = props.data.state
  if (state === 'UNREACHABLE') return {
    bg: 'bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-dark-border',
    dot: 'bg-gray-400',
    text: 'text-gray-600 dark:text-gray-400',
    label: 'UNREACHABLE',
    pulse: false
  }
  if (state === 'NOT_INSTALLED') return {
    bg: 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800',
    dot: 'bg-amber-500',
    text: 'text-amber-700 dark:text-amber-400',
    label: 'NOT_INSTALLED',
    pulse: false
  }
  if (props.data.running) return {
    bg: 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800',
    dot: 'bg-green-500',
    text: 'text-green-700 dark:text-green-400',
    label: state || 'RUNNING',
    pulse: true
  }
  return {
    bg: 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800',
    dot: 'bg-red-500',
    text: 'text-red-700 dark:text-red-400',
    label: state || 'STOPPED',
    pulse: false
  }
})
</script>

<template>
  <div v-if="loading" class="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm">
    <svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
    </svg>
    <span>Checking status...</span>
  </div>
  <div v-else-if="data && stateConfig" class="p-3 rounded-lg" :class="stateConfig.bg">
    <div class="flex items-center gap-2">
      <div class="w-2.5 h-2.5 rounded-full" :class="[stateConfig.dot, stateConfig.pulse ? 'animate-pulse' : '']"></div>
      <span class="text-sm font-semibold" :class="stateConfig.text">
        {{ stateConfig.label }}
      </span>
    </div>
  </div>
  <div v-else class="text-sm text-gray-400 dark:text-gray-500 italic">
    Click Status to check service state
  </div>
</template>
