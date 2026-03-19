<script setup>
import { computed } from 'vue'

const props = defineProps({
  kpi: {
    type: Object,
    default: null
    // { audit: number, error: number, auth: number, batch: number }
  }
})

const cards = computed(() => {
  const k = props.kpi || {}
  return [
    {
      key: 'audit',
      label: 'Audit',
      icon: 'A',
      value: k.audit ?? 0,
      iconBg: 'bg-blue-100 dark:bg-blue-900/30',
      iconText: 'text-blue-600 dark:text-blue-400'
    },
    {
      key: 'error',
      label: 'Error',
      icon: 'E',
      value: k.error ?? 0,
      iconBg: 'bg-red-100 dark:bg-red-900/30',
      iconText: 'text-red-600 dark:text-red-400'
    },
    {
      key: 'auth',
      label: 'Auth',
      icon: 'L',
      value: k.auth ?? 0,
      iconBg: 'bg-green-100 dark:bg-green-900/30',
      iconText: 'text-green-600 dark:text-green-400'
    },
    {
      key: 'batch',
      label: 'Batch',
      icon: 'B',
      value: k.batch ?? 0,
      iconBg: 'bg-purple-100 dark:bg-purple-900/30',
      iconText: 'text-purple-600 dark:text-purple-400'
    }
  ]
})

function formatNumber(n) {
  if (n == null) return '0'
  return n.toLocaleString()
}
</script>

<template>
  <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
    <div
      v-for="card in cards"
      :key="card.key"
      class="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border p-5"
    >
      <div class="flex items-center gap-3 mb-3">
        <div
          class="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
          :class="[card.iconBg, card.iconText]"
        >
          {{ card.icon }}
        </div>
      </div>
      <p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
        {{ card.label }}
      </p>
      <p class="text-2xl font-bold text-gray-900 dark:text-white">
        {{ formatNumber(card.value) }}
      </p>
    </div>
  </div>
</template>
