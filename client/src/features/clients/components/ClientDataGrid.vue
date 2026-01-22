<template>
  <div ref="gridContainer" class="w-full h-full" tabindex="0">
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
      style="width: 100%; height: 100%;"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { AgGridVue } from 'ag-grid-vue3'
import { ModuleRegistry, AllCommunityModule, themeQuartz } from 'ag-grid-community'
import { useTheme } from '../../../shared/composables/useTheme'

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule])

const { isDark } = useTheme()

// AG Grid 35 Theme API - 커스텀 테마 생성
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

// Shift+클릭 행 범위 선택을 위한 마지막 선택 행
const lastSelectedRowIndex = ref(null)

// AG Grid 35 rowSelection API - 체크박스와 클릭 선택 비활성화
const rowSelection = ref({
  mode: 'multiRow',
  checkboxes: true,
  headerCheckbox: true,
  enableClickSelection: false,
})

// Status Badge Cell Renderer
const statusCellRenderer = (params) => {
  const status = params.value
  const isOnline = status === 'online'
  const bgColor = isOnline ? 'bg-green-100 dark:bg-green-900/30' : 'bg-gray-100 dark:bg-gray-700'
  const textColor = isOnline ? 'text-green-800 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'

  return `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${bgColor} ${textColor}">
    <span class="w-1.5 h-1.5 mr-1 rounded-full ${isOnline ? 'bg-green-500' : 'bg-gray-400'}"></span>
    ${status}
  </span>`
}

// Clickable EqpId Cell Renderer
const eqpIdCellRenderer = (params) => {
  return `<span class="text-primary-600 dark:text-primary-400 hover:underline cursor-pointer font-medium">${params.value || ''}</span>`
}

const columnDefs = ref([
  {
    field: 'status',
    headerName: 'Status',
    width: 120,
    minWidth: 120,
    cellRenderer: statusCellRenderer,
    sortable: true,
    filter: true,
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
])

const defaultColDef = ref({
  resizable: true,
})

const getRowId = (params) => {
  return params.data.id || params.data.eqpId
}

const onGridReady = (params) => {
  gridApi.value = params.api
}

const onSelectionChanged = () => {
  if (!gridApi.value) return
  const selectedRows = gridApi.value.getSelectedRows()
  const selectedIds = selectedRows.map(row => row.id || row.eqpId)
  emit('selection-change', selectedIds)
}

const onCellClicked = (params) => {
  const colId = params.colDef.field
  const rowIndex = params.rowIndex

  // 체크박스 컬럼 클릭 처리
  if (colId === '_selection') {
    if (params.event.shiftKey && lastSelectedRowIndex.value !== null) {
      // Shift+클릭: 행 범위 선택
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

  // EqpId 컬럼 클릭 시 상세 페이지로 이동
  if (colId === 'eqpId') {
    emit('row-click', params.data)
    return
  }
}

// Clear selection when rowData changes
watch(() => props.rowData, () => {
  lastSelectedRowIndex.value = null
}, { deep: false })

// Expose methods for parent component
defineExpose({
  getSelectedRows: () => gridApi.value?.getSelectedRows() || [],
  clearSelection: () => {
    gridApi.value?.deselectAll()
    lastSelectedRowIndex.value = null
  },
  refreshCells: () => gridApi.value?.refreshCells({ force: true }),
})
</script>

<style>
@import '../../../shared/styles/ag-grid-scroll.css';
</style>
