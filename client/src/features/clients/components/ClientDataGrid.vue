<template>
  <div class="flex flex-col w-full h-full">
    <div ref="gridContainer" class="flex-1 min-h-0 ag-grid-custom-scrollbar" tabindex="0">
      <AgGridVue
        :theme="gridTheme"
        :rowData="rowData"
        :columnDefs="columnDefs"
        :defaultColDef="defaultColDef"
        :rowSelection="rowSelection"
        :suppressRowClickSelection="true"
        :enableCellTextSelection="true"
        :getRowId="getRowId"
        :alwaysShowHorizontalScroll="true"
        :suppressSizeToFit="true"
        @grid-ready="onGridReady"
        @selection-changed="onSelectionChanged"
        @cell-clicked="onCellClicked"
        @displayed-columns-changed="handleColumnChange"
        @column-resized="handleColumnChange"
        style="width: 100%; height: 100%;"
      />
    </div>
    <CustomHorizontalScrollbar
      :scrollState="scrollState"
      @scroll="handleCustomScroll"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { AgGridVue } from 'ag-grid-vue3'
import { ModuleRegistry, AllCommunityModule, themeQuartz } from 'ag-grid-community'
import { useTheme } from '../../../shared/composables/useTheme'
import { useCustomScrollbar } from '../../../shared/composables/useCustomScrollbar'
import CustomHorizontalScrollbar from '../../../shared/components/CustomHorizontalScrollbar.vue'

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule])

const { isDark } = useTheme()

// AG Grid 35 Theme API
const lightTheme = themeQuartz.withParams({
  fontSize: 12,
  spacing: 6,
  rowHeight: 36,
  headerHeight: 40,
  borderRadius: 0,
  wrapperBorderRadius: 0,
  backgroundColor: '#ffffff',
  headerBackgroundColor: '#f8fafc',
  borderColor: '#e2e8f0',
  foregroundColor: '#1e293b',
})

const darkTheme = themeQuartz.withParams({
  fontSize: 12,
  spacing: 6,
  rowHeight: 36,
  headerHeight: 40,
  borderRadius: 0,
  wrapperBorderRadius: 0,
  backgroundColor: '#1e293b',
  headerBackgroundColor: '#0f172a',
  borderColor: '#334155',
  foregroundColor: '#e2e8f0',
  oddRowBackgroundColor: '#1e293b',
  rowHoverColor: '#334155',
  selectedRowBackgroundColor: 'rgba(59, 130, 246, 0.2)',
})

const gridTheme = computed(() => isDark.value ? darkTheme : lightTheme)

const props = defineProps({
  rowData: {
    type: Array,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['selection-change', 'row-click'])

const gridContainer = ref(null)
const gridApi = ref(null)

// Custom Scrollbar
const { scrollState, scrollTo, handleColumnChange } = useCustomScrollbar(gridContainer)

const handleCustomScroll = (scrollLeft) => {
  scrollTo(scrollLeft)
}

// Shift+click range selection
const lastSelectedRowIndex = ref(null)

// AG Grid 35 rowSelection API
const rowSelection = ref({
  mode: 'multiRow',
  checkboxes: true,
  headerCheckbox: true,
  enableClickSelection: false,
})

// OnOff Badge Cell Renderer
const onOffCellRenderer = (params) => {
  const status = (params.value || '').toLowerCase()
  const isOn = status === 'online'

  const config = isOn
    ? { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-800 dark:text-green-400', dot: 'bg-green-500' }
    : { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-600 dark:text-gray-400', dot: 'bg-gray-400' }

  const label = isOn ? 'On' : 'Off'

  return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${config.bg} ${config.text}">
    <span class="w-1.5 h-1.5 mr-1.5 rounded-full ${config.dot}"></span>
    ${label}
  </span>`
}


// Service Status Cell Renderer (RPC-based real-time status)
const serviceCellRenderer = (params) => {
  const value = params.value

  // No data or null
  if (!value) {
    return `<span class="inline-flex items-center text-xs text-gray-400 dark:text-gray-500">
      <span class="mr-1.5">&#8213;</span> Unknown
    </span>`
  }

  // Loading state
  if (value.loading === true) {
    return `<span class="inline-flex items-center text-xs text-gray-400 dark:text-gray-500">
      <span class="inline-block w-3 h-3 mr-1.5 border-2 border-gray-300 dark:border-gray-600 border-t-gray-500 dark:border-t-gray-400 rounded-full" style="animation: spin 1s linear infinite;"></span>
      Loading...
    </span>`
  }

  // Error state
  if (value.error) {
    return `<span class="inline-flex items-center text-xs text-gray-400 dark:text-gray-500">
      <span class="mr-1.5">&#8213;</span> Unknown
    </span>`
  }

  // Running state
  if (value.running === true) {
    return `<span class="inline-flex items-center text-xs text-green-600 dark:text-green-400 font-medium">
      <span class="w-2 h-2 mr-1.5 rounded-full bg-green-500 animate-pulse"></span>
      Running
    </span>`
  }

  // Stopped state
  if (value.running === false) {
    return `<span class="inline-flex items-center text-xs text-red-600 dark:text-red-400 font-medium">
      <span class="w-2 h-2 mr-1.5 rounded-full bg-red-500"></span>
      Stopped
    </span>`
  }

  // Fallback
  return `<span class="inline-flex items-center text-xs text-gray-400 dark:text-gray-500">
    <span class="mr-1.5">&#8213;</span> Unknown
  </span>`
}

// Clickable EqpId Cell Renderer
const eqpIdCellRenderer = (params) => {
  return `<span class="text-primary-600 dark:text-primary-400 hover:underline cursor-pointer font-medium">${params.value || ''}</span>`
}

const columnDefs = ref([
  {
    field: 'serviceStatus',
    headerName: 'Status',
    width: 180,
    minWidth: 180,
    cellRenderer: serviceCellRenderer,
    sortable: false,
    filter: false,
  },
  {
    field: 'eqpId',
    headerName: 'Eqp ID',
    width: 150,
    minWidth: 150,
    cellRenderer: eqpIdCellRenderer,
    sortable: true,
    filter: true,
  },
  { field: 'eqpModel', headerName: 'Model', width: 180, minWidth: 180, sortable: true, filter: true },
  { field: 'process', headerName: 'Process', width: 120, minWidth: 120, sortable: true, filter: true },
  {
    field: 'ipAddress',
    headerName: 'IP Address',
    width: 160,
    minWidth: 160,
    sortable: true,
    filter: true,
    cellStyle: { fontFamily: 'monospace' }
  },
  { field: 'line', headerName: 'Line', width: 100, minWidth: 100, sortable: true, filter: true },
  { field: 'category', headerName: 'Category', width: 130, minWidth: 130, sortable: true, filter: true },
  { field: 'osVersion', headerName: 'OS Version', width: 180, minWidth: 180, sortable: true, filter: true },
  {
    field: 'status',
    headerName: 'OnOff',
    width: 100,
    minWidth: 100,
    cellRenderer: onOffCellRenderer,
    sortable: true,
    filter: true,
  },
])

const defaultColDef = ref({
  resizable: true,
})

const getRowId = (params) => {
  return params.data.eqpId || params.data.id
}

const onGridReady = (params) => {
  gridApi.value = params.api
  handleColumnChange()
}

const onSelectionChanged = () => {
  if (!gridApi.value) return
  const selectedRows = gridApi.value.getSelectedRows()
  const selectedIds = selectedRows.map(row => row.eqpId || row.id)
  emit('selection-change', selectedIds)
}

const onCellClicked = (params) => {
  const colId = params.colDef.field
  const rowIndex = params.rowIndex

  if (colId === '_selection') {
    if (params.event.shiftKey && lastSelectedRowIndex.value !== null) {
      const start = Math.min(lastSelectedRowIndex.value, rowIndex)
      const end = Math.max(lastSelectedRowIndex.value, rowIndex)

      for (let i = start; i <= end; i++) {
        const node = gridApi.value.getDisplayedRowAtIndex(i)
        node?.setSelected(true)
      }
    } else {
      lastSelectedRowIndex.value = rowIndex
    }
    return
  }

  if (colId === 'eqpId') {
    emit('row-click', params.data)
    return
  }
}

watch(() => props.rowData, () => {
  lastSelectedRowIndex.value = null
}, { deep: false })

defineExpose({
  getSelectedRows: () => gridApi.value?.getSelectedRows() || [],
  clearSelection: () => {
    gridApi.value?.deselectAll()
    lastSelectedRowIndex.value = null
  },
  refreshCells: () => gridApi.value?.refreshCells({ force: true }),
  restoreSelection: (ids) => {
    if (!gridApi.value || !ids?.length) return
    gridApi.value.deselectAll()
    gridApi.value.forEachNode(node => {
      const rowId = node.data?.eqpId || node.data?.id
      if (ids.includes(rowId)) {
        node.setSelected(true)
      }
    })
  },
})
</script>

<style>
@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
