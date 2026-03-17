<script setup>
import { computed } from 'vue'
import { sumByGroup, calcSuccessRate } from '../utils/recoveryStatusGroups'

const props = defineProps({
  data: { type: Array, default: () => [] },
  expandedProcess: { type: String, default: null }
})

defineEmits(['expand', 'navigate'])

// Totals row
const totals = computed(() => {
  const result = { total: 0, success: 0, failed: 0, stopped: 0, skip: 0 }
  for (const row of props.data) {
    result.total += row.total || 0
    result.success += sumByGroup(row.statusCounts, 'success')
    result.failed += sumByGroup(row.statusCounts, 'failed')
    result.stopped += sumByGroup(row.statusCounts, 'stopped')
    result.skip += sumByGroup(row.statusCounts, 'skip')
  }
  return result
})

const totalSuccessRate = computed(() => {
  if (!totals.value.total) return 0
  return (totals.value.success / totals.value.total * 100)
})

function getSuccessRateColor(rate) {
  if (rate >= 90) return 'text-green-600 dark:text-green-400'
  if (rate >= 70) return 'text-yellow-600 dark:text-yellow-400'
  return 'text-red-600 dark:text-red-400'
}
</script>

<template>
  <div class="overflow-x-auto">
    <table class="w-full text-sm">
      <thead>
        <tr class="border-b border-gray-200 dark:border-dark-border">
          <th class="text-left py-2.5 px-3 font-semibold text-gray-600 dark:text-gray-300">Process</th>
          <th class="text-right py-2.5 px-3 font-semibold text-gray-600 dark:text-gray-300">Total</th>
          <th class="text-right py-2.5 px-3 font-semibold text-gray-600 dark:text-gray-300">Success</th>
          <th class="text-right py-2.5 px-3 font-semibold text-gray-600 dark:text-gray-300">Failed</th>
          <th class="text-right py-2.5 px-3 font-semibold text-gray-600 dark:text-gray-300">Stopped</th>
          <th class="text-right py-2.5 px-3 font-semibold text-gray-600 dark:text-gray-300">Skip</th>
          <th class="text-right py-2.5 px-3 font-semibold text-gray-600 dark:text-gray-300 w-24">
            <span title="Success / Total * 100">성공률</span>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="row in data"
          :key="row.process"
          @click="$emit('expand', row.process)"
          class="cursor-pointer border-b border-gray-100 dark:border-gray-700/50 transition-colors"
          :class="expandedProcess === row.process
            ? 'bg-blue-50 dark:bg-blue-900/20'
            : 'hover:bg-gray-50 dark:hover:bg-dark-border'"
        >
          <td class="py-2.5 px-3 font-medium text-gray-900 dark:text-gray-100">
            <div class="flex items-center gap-1.5">
              <svg
                class="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 transition-transform"
                :class="{ 'rotate-90': expandedProcess === row.process }"
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
              {{ row.process }}
            </div>
          </td>
          <td class="py-2.5 px-3 text-right text-gray-700 dark:text-gray-300">{{ (row.total || 0).toLocaleString() }}</td>
          <td class="py-2.5 px-3 text-right text-green-600 dark:text-green-400">{{ sumByGroup(row.statusCounts, 'success').toLocaleString() }}</td>
          <td class="py-2.5 px-3 text-right text-red-600 dark:text-red-400">{{ sumByGroup(row.statusCounts, 'failed').toLocaleString() }}</td>
          <td class="py-2.5 px-3 text-right text-amber-600 dark:text-amber-400">{{ sumByGroup(row.statusCounts, 'stopped').toLocaleString() }}</td>
          <td class="py-2.5 px-3 text-right text-cyan-600 dark:text-cyan-400">{{ sumByGroup(row.statusCounts, 'skip').toLocaleString() }}</td>
          <td class="py-2.5 px-3 text-right font-semibold" :class="getSuccessRateColor(calcSuccessRate(row.statusCounts, row.total))">
            {{ calcSuccessRate(row.statusCounts, row.total).toFixed(1) }}%
          </td>
        </tr>

        <!-- Totals row -->
        <tr class="font-bold border-t-2 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50">
          <td class="py-2.5 px-3 text-gray-900 dark:text-gray-100">합계</td>
          <td class="py-2.5 px-3 text-right text-gray-900 dark:text-gray-100">{{ totals.total.toLocaleString() }}</td>
          <td class="py-2.5 px-3 text-right text-green-600 dark:text-green-400">{{ totals.success.toLocaleString() }}</td>
          <td class="py-2.5 px-3 text-right text-red-600 dark:text-red-400">{{ totals.failed.toLocaleString() }}</td>
          <td class="py-2.5 px-3 text-right text-amber-600 dark:text-amber-400">{{ totals.stopped.toLocaleString() }}</td>
          <td class="py-2.5 px-3 text-right text-cyan-600 dark:text-cyan-400">{{ totals.skip.toLocaleString() }}</td>
          <td class="py-2.5 px-3 text-right" :class="getSuccessRateColor(totalSuccessRate)">
            {{ totalSuccessRate.toFixed(1) }}%
          </td>
        </tr>
      </tbody>
    </table>

    <!-- Empty state -->
    <div v-if="data.length === 0" class="flex items-center justify-center py-10 text-gray-400 dark:text-gray-500 text-sm">
      데이터가 없습니다
    </div>
  </div>
</template>
