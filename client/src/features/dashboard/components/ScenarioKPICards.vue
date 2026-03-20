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
      label: '전체 시나리오',
      value: formatNumber(k.totalScenarios),
      accent: 'text-gray-900 dark:text-white',
      badge: '고정',
      badgeClass: 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
    },
    {
      label: '활성 시나리오',
      value: formatNumber(k.activeScenarios),
      accent: 'text-blue-600 dark:text-blue-400',
      badge: '고정',
      badgeClass: 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
    },
    {
      label: '수정 시나리오',
      value: formatNumber(k.modifiedScenarios),
      accent: 'text-green-600 dark:text-green-400',
      badge: '기간',
      badgeClass: 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400'
    },
    {
      label: '활동 작성자',
      value: formatNumber(k.activeAuthors),
      accent: 'text-purple-600 dark:text-purple-400',
      badge: '기간',
      badgeClass: 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
    }
  ]
})
</script>

<template>
  <div class="grid grid-cols-4 gap-4">
    <div
      v-for="(card, idx) in cards"
      :key="idx"
      class="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border p-4"
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
      </p>
    </div>
  </div>
</template>
