<script setup>
import { computed } from 'vue'

const props = defineProps({
  data: { type: Array, default: () => [] }
  // Array of { _id: string (errorType), count: number, lastOccurrence: Date }
})

const rows = computed(() => {
  return props.data.slice(0, 10)
})

function formatTimestamp(ts) {
  if (!ts) return '-'
  const d = new Date(ts)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}
</script>

<template>
  <div class="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border overflow-hidden">
    <div class="text-sm font-semibold text-gray-900 dark:text-white p-4 border-b border-gray-200 dark:border-dark-border">
      Top Errors
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
          <td class="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
            {{ formatTimestamp(row.lastOccurrence) }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
