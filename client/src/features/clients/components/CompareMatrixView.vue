<template>
  <div class="flex-1 overflow-auto min-h-0">
    <table class="w-full border-collapse text-sm">
      <!-- Header -->
      <thead class="sticky top-0 z-10">
        <tr class="bg-gray-100 dark:bg-dark-bg">
          <th class="sticky left-0 z-20 bg-gray-100 dark:bg-dark-bg px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 border-b border-r border-gray-200 dark:border-dark-border min-w-[250px] max-w-[350px]">
            Key
          </th>
          <th
            v-for="eqpId in eqpIds"
            :key="eqpId"
            class="px-3 py-2 text-left text-xs font-semibold border-b border-r border-gray-200 dark:border-dark-border min-w-[140px] max-w-[200px] whitespace-nowrap"
            :class="eqpId === baselineEqpId
              ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20'
              : 'text-gray-600 dark:text-gray-400'"
          >
            {{ eqpId }}
            <span v-if="eqpId === baselineEqpId" class="ml-1 text-[10px]" title="Baseline">&#9733;</span>
          </th>
        </tr>
      </thead>

      <!-- Body -->
      <tbody>
        <tr v-if="visibleRows.length === 0">
          <td :colspan="eqpIds.length + 1" class="px-4 py-8 text-center text-gray-400 dark:text-gray-500">
            {{ diffOnly ? 'No differences found' : 'No data' }}
          </td>
        </tr>

        <tr
          v-for="node in visibleRows"
          :key="node.fullPath"
          class="hover:bg-gray-50 dark:hover:bg-gray-800/50"
        >
          <!-- Key cell (sticky left) -->
          <td
            class="sticky left-0 z-[5] bg-white dark:bg-dark-card px-3 py-1 border-b border-r border-gray-100 dark:border-dark-border font-mono text-xs text-gray-700 dark:text-gray-300 truncate"
            :style="{ paddingLeft: `${12 + node.depth * 16}px` }"
            :title="node.fullPath"
          >
            <!-- Expand/Collapse toggle for non-leaf -->
            <button
              v-if="!node.isLeaf"
              @click="$emit('toggle-collapse', node.fullPath)"
              class="inline-flex items-center justify-center w-4 h-4 mr-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg class="w-3 h-3 transition-transform" :class="{ '-rotate-90': isCollapsed(node.fullPath) }" viewBox="0 0 12 12" fill="currentColor">
                <path d="M3 4l3 3 3-3" />
              </svg>
            </button>
            <span v-else class="inline-block w-4 mr-1"></span>

            <span :class="{ 'font-semibold text-gray-800 dark:text-gray-200': !node.isLeaf }">
              {{ node.key }}
            </span>
          </td>

          <!-- Value cells -->
          <td
            v-for="eqpId in eqpIds"
            :key="eqpId"
            class="px-3 py-1 border-b border-r border-gray-100 dark:border-dark-border font-mono text-xs max-w-[200px] truncate"
            :class="cellClass(node, eqpId)"
            :title="cellTitle(node, eqpId)"
          >
            <template v-if="node.isLeaf">
              {{ cellDisplay(node, eqpId) }}
            </template>
            <template v-else>
              <span class="text-gray-400 dark:text-gray-500 italic">
                {{ structuralLabel(node, eqpId) }}
              </span>
            </template>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
const props = defineProps({
  visibleRows: { type: Array, required: true },
  eqpIds: { type: Array, required: true },
  baselineEqpId: { type: String, required: true },
  diffResult: { type: Map, required: true },
  clientFlatMaps: { type: Object, required: true },
  collapsedPaths: { type: Set, required: true },
  diffOnly: Boolean
})

defineEmits(['toggle-collapse'])

function isCollapsed(fullPath) {
  return props.collapsedPaths.has(fullPath)
}

function getCellData(node, eqpId) {
  if (!node.isLeaf) return null
  return props.diffResult.get(node.fullPath)?.get(eqpId) ?? null
}

function cellDisplay(node, eqpId) {
  const cell = getCellData(node, eqpId)
  if (!cell) return ''
  if (cell.isMissing) return '(missing)'
  if (cell.value === null) return 'null'
  if (cell.value === undefined) return ''
  if (typeof cell.value === 'string') return cell.value
  return JSON.stringify(cell.value)
}

function cellTitle(node, eqpId) {
  const cell = getCellData(node, eqpId)
  if (!cell) return ''
  if (cell.isMissing) return 'Key missing in this client'
  const val = cell.value
  if (val === null) return 'null'
  if (typeof val === 'string') return val
  return JSON.stringify(val, null, 2)
}

function cellClass(node, eqpId) {
  if (!node.isLeaf) return 'text-gray-400 dark:text-gray-500'

  const cell = getCellData(node, eqpId)
  if (!cell) return 'text-gray-500 dark:text-gray-400'

  if (cell.isMissing) {
    return 'bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 italic'
  }
  if (cell.isDifferent) {
    return 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'
  }
  return 'text-gray-700 dark:text-gray-300'
}

function structuralLabel(node, eqpId) {
  const flatMap = props.clientFlatMaps[eqpId]
  if (!flatMap) return ''
  const entry = flatMap.get(node.fullPath)
  if (!entry) return '(missing)'
  if (entry.type === 'object') return '{...}'
  if (entry.type === 'array') return `[${entry.length}]`
  return ''
}
</script>
