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
      badge: '현재',
      badgeClass: 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300'
    },
    {
      label: '활성 시나리오',
      value: formatNumber(k.activeScenarios),
      sub: k.totalScenarios > 0 ? `(${(k.activeScenarios / k.totalScenarios * 100).toFixed(1)}%)` : '',
      accent: 'text-blue-600 dark:text-blue-400',
      badge: '현재',
      badgeClass: 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300'
    },
    {
      label: '성과 입력 시나리오',
      value: formatNumber(k.performanceFilled),
      sub: k.totalScenarios > 0 ? `(${(k.performanceFilled / k.totalScenarios * 100).toFixed(1)}%)` : '',
      accent: 'text-emerald-600 dark:text-emerald-400',
      badge: '현재',
      badgeClass: 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300'
    },
    {
      label: '수정 시나리오',
      value: formatNumber(k.modifiedScenarios),
      accent: 'text-amber-600 dark:text-amber-400',
      badge: '선택 기간',
      badgeClass: 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
    },
    {
      label: '활동 작성자',
      value: formatNumber(k.activeAuthors),
      accent: 'text-purple-600 dark:text-purple-400',
      badge: '선택 기간',
      badgeClass: 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
    }
  ]
})
</script>

<template>
  <div class="flex flex-wrap gap-4" data-testid="scenario-kpi-cards">
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
