<script setup>
import { computed } from 'vue'

const props = defineProps({
  data: { type: Array, default: () => [] }
})

const rows = computed(() => props.data.slice(0, 20))

function formatTimestamp(ts) {
  if (!ts) return '-'
  const d = new Date(ts)
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function formatTarget(row) {
  if (row.collectionName && row.targetType) return `${row.collectionName} (${row.targetType})`
  return row.collectionName || row.targetType || '-'
}

function exportCsv() {
  const csvRows = [['Timestamp', 'User', 'Action', 'Collection', 'Target Type', 'Document ID']]
  for (const row of rows.value) {
    csvRows.push([
      row.timestamp ? new Date(row.timestamp).toISOString() : '',
      row.userId || '',
      row.action || '',
      row.collectionName || '',
      row.targetType || '',
      row.documentId || ''
    ])
  }
  const csv = csvRows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'recent_audits.csv'
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="w-full">
    <div class="flex justify-end mb-2">
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
      class="flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm"
      style="height: 280px"
    >
      No audit data
    </div>

    <!-- Table with fixed height scroll -->
    <div v-else class="overflow-auto" style="max-height: 450px">
      <table class="w-full text-sm">
        <thead class="sticky top-0 z-10">
          <tr class="text-xs text-gray-500 dark:text-gray-400 uppercase bg-gray-50 dark:bg-slate-800">
            <th class="px-3 py-2 font-medium text-left whitespace-nowrap">Time</th>
            <th class="px-3 py-2 font-medium text-left">User</th>
            <th class="px-3 py-2 font-medium text-left">Action</th>
            <th class="px-3 py-2 font-medium text-left">Collection / Target</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(row, idx) in rows"
            :key="idx"
            class="border-b border-gray-100 dark:border-dark-border/50 hover:bg-gray-50 dark:hover:bg-dark-border/30 transition-colors"
          >
            <td class="px-3 py-2 text-gray-500 dark:text-gray-400 whitespace-nowrap text-xs">
              {{ formatTimestamp(row.timestamp) }}
            </td>
            <td class="px-3 py-2 text-gray-900 dark:text-white font-medium truncate max-w-[120px]" :title="row.userId">
              {{ row.userId || '-' }}
            </td>
            <td class="px-3 py-2">
              <span
                class="inline-block px-1.5 py-0.5 text-xs rounded font-medium"
                :class="{
                  'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400': row.action === 'create',
                  'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400': row.action === 'update',
                  'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400': row.action === 'delete',
                  'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300': !['create','update','delete'].includes(row.action)
                }"
              >
                {{ row.action || '-' }}
              </span>
            </td>
            <td class="px-3 py-2 text-gray-600 dark:text-gray-300 text-xs truncate max-w-[200px]" :title="formatTarget(row)">
              {{ formatTarget(row) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
