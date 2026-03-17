<script setup>
import { computed } from 'vue'

const props = defineProps({
  lastAggregation: { type: Object, default: null }
})

const emit = defineEmits(['refresh'])

const formattedTime = computed(() => {
  if (!props.lastAggregation?.timestamp) return null
  try {
    const d = new Date(props.lastAggregation.timestamp)
    return d.toLocaleString('ko-KR', {
      month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
      hour12: false
    })
  } catch {
    return null
  }
})

const freshness = computed(() => {
  if (!props.lastAggregation?.timestamp) return 'unknown'
  const diff = Date.now() - new Date(props.lastAggregation.timestamp).getTime()
  const hours = diff / (1000 * 60 * 60)
  if (hours < 1) return 'fresh'
  if (hours < 6) return 'recent'
  return 'stale'
})

const freshnessClass = computed(() => {
  switch (freshness.value) {
    case 'fresh': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
    case 'recent': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
    case 'stale': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    default: return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
  }
})

const dotClass = computed(() => {
  switch (freshness.value) {
    case 'fresh': return 'bg-green-500'
    case 'recent': return 'bg-yellow-500'
    case 'stale': return 'bg-red-500'
    default: return 'bg-gray-400'
  }
})
</script>

<template>
  <div class="flex items-center gap-2">
    <div
      v-if="formattedTime"
      class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium"
      :class="freshnessClass"
    >
      <span class="w-1.5 h-1.5 rounded-full" :class="dotClass"></span>
      <span>집계: {{ formattedTime }}</span>
    </div>
    <div
      v-else
      class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
    >
      <span class="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
      <span>집계 정보 없음</span>
    </div>
    <button
      @click="emit('refresh')"
      class="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded hover:bg-gray-100 dark:hover:bg-dark-border transition-colors"
      title="새로고침"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    </button>
  </div>
</template>
