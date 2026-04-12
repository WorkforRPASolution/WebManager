<script setup>
import { computed } from 'vue'
import { sumByGroup, calcSuccessRate } from '../utils/recoveryStatusGroups'

const props = defineProps({
  data: { type: Array, default: () => [] },
  expandedCategory: { type: Number, default: null }
})

defineEmits(['expand'])

const totals = computed(() => {
  const result = { total: 0, success: 0, failed: 0, stopped: 0, skip: 0 }
  for (const row of props.data) {
    result.total += row.total || 0
    result.success += sumByGroup(row.statusCounts, 'success')
    result.failed += sumByGroup(row.statusCounts, 'failed')
    result.stopped += (row.statusCounts?.Stopped || 0)
    result.skip += (row.statusCounts?.Skip || 0)
  }
  return result
})

const totalSuccessRate = computed(() => {
  if (!totals.value.total) return 0
  return totals.value.success / totals.value.total * 100
})

function getSuccessRateColor(rate) {
  if (rate >= 90) return 'text-green-600 dark:text-green-400'
  if (rate >= 70) return 'text-yellow-600 dark:text-yellow-400'
  return 'text-red-600 dark:text-red-400'
}

function getRowSuccessRate(row) {
  const sc = row.statusCounts || {}
  const success = sumByGroup(sc, 'success')
  return row.total > 0 ? (success / row.total * 100) : 0
}
</script>

<template>
  <div v-if="data.length === 0" class="flex items-center justify-center py-10 text-gray-400 dark:text-gray-500 text-sm">
    데이터가 없습니다
  </div>
  <div v-else class="overflow-x-auto">
    <table class="w-full text-sm">
      <thead>
        <tr class="border-b border-gray-200 dark:border-dark-border text-left">
          <th class="py-2.5 px-3 font-semibold text-gray-600 dark:text-gray-400">Category</th>
          <th class="py-2.5 px-3 font-semibold text-gray-600 dark:text-gray-400 text-right">Total</th>
          <th class="py-2.5 px-3 font-semibold text-gray-600 dark:text-gray-400 text-right">Success</th>
          <th class="py-2.5 px-3 font-semibold text-gray-600 dark:text-gray-400 text-right">Failed</th>
          <th class="py-2.5 px-3 font-semibold text-gray-600 dark:text-gray-400 text-right">Stopped</th>
          <th class="py-2.5 px-3 font-semibold text-gray-600 dark:text-gray-400 text-right">Skip</th>
          <th class="py-2.5 px-3 font-semibold text-gray-600 dark:text-gray-400 text-right w-24">Success Rate</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="row in data"
          :key="row.scCategory"
          class="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-dark-border transition-colors"
        >
          <td class="py-2.5 px-3 font-medium text-gray-900 dark:text-gray-100">
            <span>{{ row.categoryName }}</span>
            <span v-if="row.scCategory !== -1" class="text-xs text-gray-400 dark:text-gray-500 ml-1">({{ row.scCategory }})</span>
          </td>
          <td class="py-2.5 px-3 text-right text-gray-700 dark:text-gray-300">
            {{ (row.total || 0).toLocaleString() }}
          </td>
          <td class="py-2.5 px-3 text-right text-green-600 dark:text-green-400">
            {{ sumByGroup(row.statusCounts, 'success').toLocaleString() }}
          </td>
          <td class="py-2.5 px-3 text-right text-red-600 dark:text-red-400">
            {{ sumByGroup(row.statusCounts, 'failed').toLocaleString() }}
          </td>
          <td class="py-2.5 px-3 text-right text-amber-600 dark:text-amber-400">
            {{ (row.statusCounts?.Stopped || 0).toLocaleString() }}
          </td>
          <td class="py-2.5 px-3 text-right text-cyan-600 dark:text-cyan-400">
            {{ (row.statusCounts?.Skip || 0).toLocaleString() }}
          </td>
          <td class="py-2.5 px-3 text-right font-semibold"
              :class="row.total ? getSuccessRateColor(getRowSuccessRate(row)) : 'text-gray-400 dark:text-gray-500'">
            {{ row.total ? `${getRowSuccessRate(row).toFixed(1)}%` : '∅' }}
          </td>
        </tr>
        <!-- Totals -->
        <tr class="font-bold border-t-2 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50">
          <td class="py-2.5 px-3 text-gray-900 dark:text-gray-100">Total</td>
          <td class="py-2.5 px-3 text-right text-gray-900 dark:text-gray-100">{{ totals.total.toLocaleString() }}</td>
          <td class="py-2.5 px-3 text-right text-green-600 dark:text-green-400">{{ totals.success.toLocaleString() }}</td>
          <td class="py-2.5 px-3 text-right text-red-600 dark:text-red-400">{{ totals.failed.toLocaleString() }}</td>
          <td class="py-2.5 px-3 text-right text-amber-600 dark:text-amber-400">{{ totals.stopped.toLocaleString() }}</td>
          <td class="py-2.5 px-3 text-right text-cyan-600 dark:text-cyan-400">{{ totals.skip.toLocaleString() }}</td>
          <td class="py-2.5 px-3 text-right font-semibold"
              :class="totals.total ? getSuccessRateColor(totalSuccessRate) : 'text-gray-400'">
            {{ totals.total ? `${totalSuccessRate.toFixed(1)}%` : '∅' }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
