<script setup>
import { computed } from 'vue'

const props = defineProps({
  kpi: { type: Object, default: null }
})

function formatNumber(n) {
  if (n == null) return '0'
  return n.toLocaleString()
}

const cards = computed(() => {
  const k = props.kpi || {}
  return [
    {
      label: '전체 사용자',
      value: formatNumber(k.totalUsers),
      accent: 'text-gray-900 dark:text-white'
    },
    {
      label: 'SE 사용자',
      value: formatNumber(k.activeUsers),
      accent: 'text-blue-600 dark:text-blue-400'
    },
    {
      label: '사용률',
      value: k.usageRate != null ? `${k.usageRate.toFixed(1)}%` : '0%',
      accent: 'text-green-600 dark:text-green-400'
    }
  ]
})
</script>

<template>
  <div class="grid grid-cols-3 gap-4">
    <div
      v-for="(card, idx) in cards"
      :key="idx"
      class="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border p-4"
    >
      <p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
        {{ card.label }}
      </p>
      <p class="text-2xl font-bold" :class="card.accent">
        {{ card.value }}
      </p>
    </div>
  </div>
</template>
