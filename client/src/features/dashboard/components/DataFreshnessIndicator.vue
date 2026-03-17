<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  lastAggregation: {
    type: Object,
    default: null
    // { hourly: { completedAt, bucket }, daily: { completedAt, bucket } }
  }
})

defineEmits(['refresh'])

const now = ref(Date.now())
let timer = null

onMounted(() => {
  timer = setInterval(() => {
    now.value = Date.now()
  }, 60000) // 1분마다 갱신
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})

const latestCompletedAt = computed(() => {
  if (!props.lastAggregation) return null
  const hourly = props.lastAggregation.hourly?.completedAt
  const daily = props.lastAggregation.daily?.completedAt
  // 더 최근 값 사용
  if (hourly && daily) {
    return new Date(hourly) > new Date(daily) ? hourly : daily
  }
  return hourly || daily || null
})

const formattedTime = computed(() => {
  if (!latestCompletedAt.value) return '-'
  const d = new Date(latestCompletedAt.value)
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
})

const relativeTime = computed(() => {
  if (!latestCompletedAt.value) return ''
  const diff = now.value - new Date(latestCompletedAt.value).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return '방금 전'
  if (minutes < 60) return `${minutes}분 전`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}시간 전`
  const days = Math.floor(hours / 24)
  return `${days}일 전`
})

const isStale = computed(() => {
  if (!latestCompletedAt.value) return false
  const diff = now.value - new Date(latestCompletedAt.value).getTime()
  return diff > 2 * 60 * 60 * 1000 // 2시간 초과
})
</script>

<template>
  <div class="flex items-center gap-2 text-sm">
    <span v-if="latestCompletedAt" class="text-gray-500 dark:text-gray-400">
      마지막 집계: {{ formattedTime }} ({{ relativeTime }})
    </span>
    <button
      @click="$emit('refresh')"
      class="p-1 rounded hover:bg-gray-100 dark:hover:bg-dark-border transition-colors text-gray-500 dark:text-gray-400"
      title="새로고침"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    </button>
    <span v-if="isStale" class="text-amber-600 dark:text-amber-400 text-xs flex items-center gap-1">
      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
      </svg>
      집계 데이터가 지연되고 있습니다
    </span>
  </div>
</template>
