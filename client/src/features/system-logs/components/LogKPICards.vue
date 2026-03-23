<script setup>
import { computed } from 'vue'

const props = defineProps({
  kpi: { type: Object, default: null },
  periodLabel: { type: String, default: '선택 기간' }
})

function formatNumber(n) {
  if (n == null) return '0'
  return n.toLocaleString()
}

const cards = computed(() => {
  const k = props.kpi || {}
  return [
    {
      label: '전체 로그',
      value: formatNumber(k.total),
      sub: '건',
      accent: 'text-blue-600 dark:text-blue-400',
      badgeClass: 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
    },
    {
      label: '에러율',
      value: k.errorRate != null ? k.errorRate.toFixed(1) : '0',
      sub: `% (${formatNumber(k.error)}건)`,
      accent: 'text-red-600 dark:text-red-400',
      badgeClass: 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400'
    },
    {
      label: '보안 이벤트',
      value: formatNumber(k.securityEvents),
      sub: '건',
      accent: 'text-amber-600 dark:text-amber-400',
      badgeClass: 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
    },
    {
      label: '배치 성공률',
      value: k.batchSuccessRate != null ? k.batchSuccessRate.toFixed(1) : '0',
      sub: `% (${formatNumber(k.batchTotal)}건)`,
      accent: 'text-emerald-600 dark:text-emerald-400',
      badgeClass: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
    },
    {
      label: '일평균 변경',
      value: k.auditPerDay != null ? k.auditPerDay.toFixed(1) : '0',
      sub: '건/일',
      accent: 'text-purple-600 dark:text-purple-400',
      badgeClass: 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
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
          {{ periodLabel }}
        </span>
      </div>
      <p class="text-2xl font-bold" :class="card.accent">
        {{ card.value }}
        <span class="text-sm font-medium text-gray-400 dark:text-gray-500">{{ card.sub }}</span>
      </p>
    </div>
  </div>
</template>
