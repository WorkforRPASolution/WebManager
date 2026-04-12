<script setup>
import { computed } from 'vue'

const props = defineProps({
  kpi: {
    type: Object,
    default: null
    // { total, success, failed, stopped, skip, successRate, prevTotal, prevSuccess, prevSuccessRate }
  },
  // 외부에서 카드 배열을 직접 주입할 때 사용 (예: Recovery by Category)
  // [{ label, value, delta?, deltaLabel?, deltaColor?, accent? }]
  customCards: {
    type: Array,
    default: null
  },
  vertical: {
    type: Boolean,
    default: false
  }
})

function formatNumber(n) {
  if (n == null) return '0'
  return n.toLocaleString()
}

function calcDelta(current, prev) {
  if (current == null || prev == null) return null
  return current - prev
}

const defaultCards = computed(() => {
  const k = props.kpi || {}
  const totalDelta = calcDelta(k.total, k.prevTotal)
  const successRateDelta = k.successRate != null && k.prevSuccessRate != null
    ? (k.successRate - k.prevSuccessRate)
    : null

  return [
    {
      label: 'Total Executions',
      value: formatNumber(k.total),
      delta: totalDelta,
      deltaLabel: totalDelta != null ? formatNumber(Math.abs(totalDelta)) : null,
      // total 증가는 중립 (회색)
      deltaColor: 'neutral'
    },
    {
      label: 'Success',
      value: formatNumber(k.success),
      delta: null,
      deltaLabel: null,
      deltaColor: 'neutral',
      accent: 'text-green-600 dark:text-green-400'
    },
    {
      label: 'Failed',
      value: formatNumber(k.failed),
      delta: null,
      deltaLabel: null,
      deltaColor: 'neutral',
      accent: 'text-red-600 dark:text-red-400'
    },
    {
      label: 'Stopped',
      value: formatNumber(k.stopped),
      delta: null,
      deltaLabel: null,
      deltaColor: 'neutral',
      accent: 'text-amber-600 dark:text-amber-400'
    },
    {
      label: 'Skip',
      value: formatNumber(k.skip),
      delta: null,
      deltaLabel: null,
      deltaColor: 'neutral',
      accent: 'text-cyan-600 dark:text-cyan-400'
    },
    {
      label: 'Success Rate',
      value: k.successRate != null ? `${k.successRate.toFixed(1)}%` : '0%',
      delta: successRateDelta,
      deltaLabel: successRateDelta != null ? `${Math.abs(successRateDelta).toFixed(1)}%p` : null,
      // 성공률 증가는 green, 감소는 red
      deltaColor: 'rate'
    }
  ]
})

const cards = computed(() => props.customCards || defaultCards.value)

const gridClass = computed(() => {
  if (props.vertical) return 'grid-cols-1'
  const len = cards.value.length
  if (len <= 4) return 'grid-cols-2 md:grid-cols-4'
  return 'grid-cols-2 md:grid-cols-3 xl:grid-cols-6'
})

function getDeltaIcon(delta) {
  if (delta == null || delta === 0) return ''
  return delta > 0 ? '\u25B2' : '\u25BC'
}

function getDeltaClass(card) {
  if (card.delta == null || card.delta === 0) return 'text-gray-400 dark:text-gray-500'
  if (card.deltaColor === 'rate') {
    return card.delta > 0
      ? 'text-green-600 dark:text-green-400'
      : 'text-red-600 dark:text-red-400'
  }
  // neutral
  return card.delta > 0
    ? 'text-gray-500 dark:text-gray-400'
    : 'text-gray-500 dark:text-gray-400'
}
</script>

<template>
  <div class="grid gap-4" :class="gridClass">
    <div
      v-for="(card, idx) in cards"
      :key="idx"
      class="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border p-4"
    >
      <p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
        {{ card.label }}
      </p>
      <p
        class="text-2xl font-bold"
        :class="card.accent || 'text-gray-900 dark:text-white'"
      >
        {{ card.value }}
      </p>
      <p
        v-if="card.deltaLabel != null"
        class="text-xs mt-1"
        :class="getDeltaClass(card)"
      >
        {{ getDeltaIcon(card.delta) }} {{ card.deltaLabel }}
      </p>
    </div>
  </div>
</template>
