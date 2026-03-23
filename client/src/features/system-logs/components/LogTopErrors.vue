<script setup>
import { computed } from 'vue'

const props = defineProps({
  data: { type: Array, default: () => [] }
})

const rows = computed(() => props.data.slice(0, 10))

const totalErrors = computed(() => rows.value.reduce((sum, r) => sum + (r.count || 0), 0))

function formatTimestamp(ts) {
  if (!ts) return '-'
  const d = new Date(ts)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function getPercent(count) {
  if (!totalErrors.value || !count) return '0'
  return (count / totalErrors.value * 100).toFixed(1)
}

function exportCsv() {
  const csvRows = [['Rank', 'Error Type', 'Count', 'Percent', 'Last Occurrence']]
  for (let i = 0; i < rows.value.length; i++) {
    const row = rows.value[i]
    csvRows.push([
      i + 1,
      row._id || '',
      row.count || 0,
      getPercent(row.count) + '%',
      row.lastOccurrence ? new Date(row.lastOccurrence).toISOString() : ''
    ])
  }
  const csv = csvRows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'top_errors.csv'
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border overflow-hidden">
    <div class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-dark-border">
      <span class="text-sm font-semibold text-gray-900 dark:text-white">Top Errors</span>
      <button
        v-if="rows.length > 0"
        @click="exportCsv"
        class="text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
      >
        CSV
      </button>
    </div>

    <!-- Empty state -->
    <div
      v-if="rows.length === 0"
      class="text-center py-12 text-gray-400 dark:text-gray-500 text-sm"
    >
      No errors in this period
    </div>

    <!-- Table -->
    <table v-else class="w-full text-sm">
      <thead>
        <tr class="text-xs text-gray-500 dark:text-gray-400 uppercase bg-gray-50 dark:bg-slate-800">
          <th class="px-4 py-3 font-medium text-left w-10">#</th>
          <th class="px-4 py-3 font-medium text-left">Error Type</th>
          <th class="px-4 py-3 font-medium text-right">Count</th>
          <th class="px-4 py-3 font-medium text-right">%</th>
          <th class="px-4 py-3 font-medium text-left">Last Occurrence</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(row, idx) in rows"
          :key="row._id || idx"
          class="border-b border-gray-100 dark:border-dark-border/50 hover:bg-gray-50 dark:hover:bg-dark-border/30 transition-colors"
        >
          <td class="px-4 py-3 text-gray-400 dark:text-gray-500">
            {{ idx + 1 }}
          </td>
          <td class="px-4 py-3 text-gray-900 dark:text-white font-medium truncate max-w-xs" :title="row._id">
            {{ row._id || '-' }}
          </td>
          <td class="px-4 py-3 text-right font-bold text-gray-900 dark:text-white">
            {{ (row.count ?? 0).toLocaleString() }}
          </td>
          <td class="px-4 py-3 text-right text-gray-500 dark:text-gray-400">
            {{ getPercent(row.count) }}%
          </td>
          <td class="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
            {{ formatTimestamp(row.lastOccurrence) }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
