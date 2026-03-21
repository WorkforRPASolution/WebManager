<script setup>
import { computed } from 'vue'

const props = defineProps({
  kpi: { type: Object, default: null }
})

function formatNumber(n) {
  if (n == null) return '0'
  return n.toLocaleString()
}

function formatDuration(ms) {
  if (!ms || ms <= 0) return '0s'
  const totalSec = Math.round(ms / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  if (min === 0) return `${sec}s`
  return `${min}m ${sec}s`
}

const cards = computed(() => {
  const k = props.kpi || {}
  return [
    {
      label: '활성 사용자',
      value: formatNumber(k.activeUsers),
      accent: 'text-blue-600 dark:text-blue-400',
      badge: '선택 기간',
      badgeClass: 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
    },
    {
      label: '총 페이지 방문',
      value: formatNumber(k.totalVisits),
      accent: 'text-gray-900 dark:text-white',
      badge: '선택 기간',
      badgeClass: 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300'
    },
    {
      label: '페이지 도달률',
      value: `${k.visitedPages || 0} / ${k.totalPages || 0}`,
      sub: k.totalPages > 0 ? `(${(k.pageReachRate || 0).toFixed(1)}%)` : '',
      accent: 'text-emerald-600 dark:text-emerald-400',
      badge: '선택 기간',
      badgeClass: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
    },
    {
      label: '평균 체류 시간',
      value: formatDuration(k.avgDurationMs),
      accent: 'text-amber-600 dark:text-amber-400',
      badge: '선택 기간',
      badgeClass: 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
    }
  ]
})
</script>

<template>
  <div class="flex flex-wrap gap-4">
    <div
      v-for="(card, idx) in cards"
      :key="idx"
      class="flex-1 min-w-[160px] bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border p-4"
    >
      <div class="flex items-center gap-2 mb-1">
        <p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          {{ card.label }}
        </p>
        <span class="px-1.5 py-0.5 text-[10px] font-medium rounded" :class="card.badgeClass">
          {{ card.badge }}
        </span>
      </div>
      <p class="text-2xl font-bold" :class="card.accent">
        {{ card.value }}
        <span v-if="card.sub" class="text-sm font-medium text-gray-400 dark:text-gray-500">{{ card.sub }}</span>
      </p>
    </div>
  </div>
</template>
