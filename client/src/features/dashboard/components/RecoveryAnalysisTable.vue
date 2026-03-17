<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  data: { type: Array, default: () => [] },
  tab: { type: String, default: 'scenario' },
  selectedRows: { type: Array, default: () => [] }
})

const emit = defineEmits(['select', 'history'])

const sortKey = ref('total')
const sortAsc = ref(false)

const columns = computed(() => {
  const base = [
    { key: 'total', label: 'Total', numeric: true },
    { key: 'Success', label: 'Success', numeric: true, status: true },
    { key: 'Failed', label: 'Failed', numeric: true, status: true },
    { key: 'Stopped', label: 'Stopped', numeric: true, status: true },
    { key: 'Skip', label: 'Skip', numeric: true, status: true },
    { key: 'rate', label: '성공률', numeric: true }
  ]

  if (props.tab === 'scenario') {
    return [
      { key: 'name', label: 'ears_code', numeric: false },
      ...base
    ]
  } else if (props.tab === 'equipment') {
    return [
      { key: 'name', label: 'eqpid', numeric: false },
      { key: 'process', label: 'Process', numeric: false },
      { key: 'model', label: 'Model', numeric: false },
      ...base
    ]
  } else {
    return [
      { key: 'name', label: 'trigger_by', numeric: false },
      ...base
    ]
  }
})

function getCellValue(row, col) {
  if (col.status) {
    return (row.statusCounts && row.statusCounts[col.key]) || 0
  }
  if (col.key === 'total') return row.total || 0
  if (col.key === 'rate') {
    const total = row.total || 0
    if (total === 0) return 0
    return Math.round(((row.statusCounts?.Success || 0) / total) * 100)
  }
  if (col.key === 'name') return row.name || ''
  if (col.key === 'process') return row.process || ''
  if (col.key === 'model') return row.model || ''
  return ''
}

function formatCellValue(row, col) {
  const val = getCellValue(row, col)
  if (col.key === 'rate') return val + '%'
  return val
}

const sortedData = computed(() => {
  const arr = [...props.data]
  arr.sort((a, b) => {
    const colDef = columns.value.find(c => c.key === sortKey.value)
    const valA = getCellValue(a, colDef || { key: sortKey.value })
    const valB = getCellValue(b, colDef || { key: sortKey.value })
    let cmp
    if (typeof valA === 'number' && typeof valB === 'number') {
      cmp = valA - valB
    } else {
      cmp = String(valA).localeCompare(String(valB))
    }
    return sortAsc.value ? cmp : -cmp
  })
  return arr
})

function handleSort(key) {
  if (sortKey.value === key) {
    sortAsc.value = !sortAsc.value
  } else {
    sortKey.value = key
    sortAsc.value = key === 'name' || key === 'process' || key === 'model'
  }
}

function isSelected(row) {
  return props.selectedRows.includes(row.name)
}

function toggleRow(row) {
  const name = row.name
  const current = [...props.selectedRows]
  const idx = current.indexOf(name)
  if (idx >= 0) {
    current.splice(idx, 1)
  } else {
    current.push(name)
  }
  emit('select', current)
}

function handleHistory(row) {
  emit('history', row)
}

function rateClass(val) {
  if (val >= 90) return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
  if (val >= 50) return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
  if (val > 0) return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
  return 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
}

function statusCellClass(col, value) {
  if (!col.status || value === 0) return 'text-gray-400 dark:text-gray-500'
  if (col.key === 'Success') return 'text-green-600 dark:text-green-400'
  if (col.key === 'Failed') return 'text-red-600 dark:text-red-400'
  if (col.key === 'Stopped') return 'text-amber-600 dark:text-amber-400'
  if (col.key === 'Skip') return 'text-cyan-600 dark:text-cyan-400'
  return ''
}
</script>

<template>
  <div>
    <!-- Empty state -->
    <div
      v-if="data.length === 0"
      class="text-center py-8 text-gray-400 dark:text-gray-500 text-sm"
    >
      데이터가 없습니다
    </div>

    <!-- Table -->
    <div v-else class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-gray-200 dark:border-dark-border">
            <th class="w-8 py-3 px-2">
              <!-- checkbox column header -->
            </th>
            <th
              v-for="col in columns"
              :key="col.key"
              class="py-3 px-3 font-semibold text-gray-600 dark:text-gray-300 cursor-pointer select-none hover:text-gray-900 dark:hover:text-white transition-colors"
              :class="col.numeric ? 'text-right' : 'text-left'"
              @click="handleSort(col.key)"
            >
              <span class="inline-flex items-center gap-1">
                {{ col.label }}
                <svg
                  v-if="sortKey === col.key"
                  class="w-3 h-3 transition-transform"
                  :class="{ 'rotate-180': !sortAsc }"
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                </svg>
              </span>
            </th>
            <th v-if="tab !== 'trigger'" class="w-24 py-3 px-3 text-center font-semibold text-gray-600 dark:text-gray-300 whitespace-nowrap">
              이력
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(row, idx) in sortedData"
            :key="idx"
            class="border-b border-gray-100 dark:border-dark-border/50 transition-colors"
            :class="isSelected(row) ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-dark-border/30'"
          >
            <td class="py-2.5 px-2 text-center">
              <input
                type="checkbox"
                :checked="isSelected(row)"
                @change="toggleRow(row)"
                class="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 dark:bg-dark-card"
              />
            </td>
            <td
              v-for="col in columns"
              :key="col.key"
              class="py-2.5 px-3"
              :class="col.numeric ? 'text-right' : 'text-left'"
            >
              <template v-if="col.key === 'rate'">
                <span
                  class="inline-block min-w-[3rem] text-center px-2 py-0.5 rounded-full text-xs font-medium"
                  :class="rateClass(getCellValue(row, col))"
                >
                  {{ formatCellValue(row, col) }}
                </span>
              </template>
              <template v-else-if="col.key === 'name'">
                <span class="font-medium text-gray-900 dark:text-white">{{ formatCellValue(row, col) }}</span>
              </template>
              <template v-else>
                <span :class="statusCellClass(col, getCellValue(row, col))">
                  {{ formatCellValue(row, col) }}
                </span>
              </template>
            </td>
            <td v-if="tab !== 'trigger'" class="py-2.5 px-3 text-center">
              <button
                @click="handleHistory(row)"
                class="px-2 py-1 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors whitespace-nowrap"
                title="이력 조회"
              >
                이력조회
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
