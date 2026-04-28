<template>
  <div class="flex flex-col w-full h-full">
    <div ref="gridContainer" class="flex-1 min-h-0 ag-grid-custom-scrollbar" @copy="handleCopy" tabindex="0">
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
import { classifyServiceState } from '../utils/serviceState.js'
import { useCustomScrollbar } from '../../../shared/composables/useCustomScrollbar'
import { useColumnWidthExporter } from '../../../shared/composables/useColumnWidthExporter'
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
  const state = classifyServiceState(value)

  const configs = {
    loading: { icon: '<span class="inline-block w-3 h-3 mr-1.5 border-2 border-gray-300 dark:border-gray-600 border-t-gray-500 dark:border-t-gray-400 rounded-full" style="animation: spin 1s linear infinite;"></span>', label: 'Loading...', cls: 'text-gray-400 dark:text-gray-500' },
    unreachable: { icon: '<span class="w-2 h-2 mr-1.5 rounded-full bg-gray-400"></span>', label: 'Unreachable', cls: 'text-gray-500 dark:text-gray-400 font-medium' },
    not_installed: { icon: '<span class="w-2 h-2 mr-1.5 rounded-full bg-amber-500"></span>', label: 'Not Installed', cls: 'text-amber-600 dark:text-amber-400 font-medium' },
    running: { icon: '<span class="w-2 h-2 mr-1.5 rounded-full bg-green-500 animate-pulse"></span>', label: 'Running', cls: 'text-green-600 dark:text-green-400 font-medium' },
    stopped: { icon: '<span class="w-2 h-2 mr-1.5 rounded-full bg-red-500"></span>', label: 'Stopped', cls: 'text-red-600 dark:text-red-400 font-medium' },
    unknown: { icon: '<span class="mr-1.5">&#8213;</span>', label: 'Unknown', cls: 'text-gray-400 dark:text-gray-500' },
  }

  const cfg = configs[state]
  return `<span class="inline-flex items-center text-xs ${cfg.cls}">${cfg.icon} ${cfg.label}</span>`
}

// Uptime Cell Renderer (Redis-based alive status)
const uptimeCellRenderer = (params) => {
  const value = params.value

  // No data
  if (!value) {
    return `<span class="inline-flex items-center text-xs text-gray-400 dark:text-gray-500">
      <span class="mr-1">&#8213;</span>
    </span>`
  }

  // Redis unavailable
  if (value.redisUnavailable) {
    return `<span class="inline-flex items-center text-xs text-gray-400 dark:text-gray-500">
      <span class="mr-1">&#8213;</span>
    </span>`
  }

  // Alive + OK
  if (value.alive && value.health === 'OK') {
    return `<span class="inline-flex items-center text-xs text-green-600 dark:text-green-400 font-medium">
      <span class="w-2 h-2 mr-1.5 rounded-full bg-green-500"></span>
      ${value.uptimeFormatted || '\u2014'}
    </span>`
  }

  // Alive + WARN (future)
  if (value.alive && value.health === 'WARN') {
    return `<span class="inline-flex items-center text-xs text-amber-600 dark:text-amber-400 font-medium" title="${value.reason || ''}">
      <span class="w-2 h-2 mr-1.5 rounded-full bg-amber-500"></span>
      ${value.uptimeFormatted || '\u2014'}
    </span>`
  }

  // Not alive
  if (value.alive === false) {
    return `<span class="inline-flex items-center text-xs text-gray-400 dark:text-gray-500">
      <span class="w-2 h-2 mr-1.5 rounded-full bg-gray-300 dark:bg-gray-600"></span>
      <span>&#8213;</span>
    </span>`
  }

  // Fallback
  return `<span class="inline-flex items-center text-xs text-gray-400 dark:text-gray-500">
    <span class="mr-1">&#8213;</span>
  </span>`
}

// Agent Version Cell Renderer
const versionCellRenderer = (params) => {
  const version = params.value
  if (!version) return '<span class="text-gray-400 dark:text-gray-500">&#8213;</span>'
  return `<span class="text-xs font-mono">${version}</span>`
}

// TODO: Client Detail 페이지 구현 후 클릭 스타일 복원
const eqpIdCellRenderer = (params) => {
  return `<span class="font-medium">${params.value || ''}</span>`
}

const columnDefs = ref([
  {
    field: 'serviceStatus',
    headerName: 'Status',
    width: 105,
    cellRenderer: serviceCellRenderer,
    sortable: false,
    filter: false,
  },
  {
    field: 'aliveStatus',
    headerName: 'Uptime',
    width: 95,
    cellRenderer: uptimeCellRenderer,
    sortable: false,
    filter: false,
  },
  {
    field: 'eqpId',
    headerName: 'Eqp ID',
    width: 180,
    cellRenderer: eqpIdCellRenderer,
    sortable: true,
    filter: true,
  },
  {
    field: 'ipAddress',
    headerName: 'IP Address',
    width: 110,
    sortable: true,
    filter: true,
    cellStyle: { fontFamily: 'monospace' }
  },
  {
    field: 'innerIp',
    headerName: 'Inner IP',
    width: 110,
    sortable: true,
    filter: true,
    cellStyle: { fontFamily: 'monospace' }
  },
  { field: 'line', headerName: 'Line', width: 85, sortable: true, filter: true },
  { field: 'process', headerName: 'Process', width: 120, sortable: true, filter: true },
  { field: 'eqpModel', headerName: 'Model', width: 180, sortable: true, filter: true },
  { field: 'category', headerName: 'Category', width: 110, sortable: true, filter: true },
  { field: 'osVersion', headerName: 'OS Version', width: 100, sortable: true, filter: true },
  {
    field: 'agentVersion',
    headerName: 'Version',
    width: 110,
    cellRenderer: versionCellRenderer,
    sortable: false,
    filter: false,
  },
  {
    field: 'status',
    headerName: 'OnOff',
    width: 100,
    cellRenderer: onOffCellRenderer,
    sortable: true,
    filter: true,
  },
])

const defaultColDef = ref({
  resizable: true,
  minWidth: 80,
})

const getRowId = (params) => {
  return params.data.eqpId || params.data.id
}

// Admin용: 컬럼 폭 클립보드 복사
const { exportColumnWidths } = useColumnWidthExporter(gridApi)

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

// 셀 값을 클립보드용 사람이 보는 텍스트로 변환 (특수 렌더러 컬럼 라벨 매핑)
function formatCellForCopy(field, value) {
  // null 도 'Unknown' 라벨로 변환되어야 하므로 serviceStatus 가 먼저
  if (field === 'serviceStatus') {
    const labels = {
      running: 'Running', stopped: 'Stopped', unreachable: 'Unreachable',
      not_installed: 'Not Installed', loading: '', unknown: 'Unknown'
    }
    return labels[classifyServiceState(value)] ?? ''
  }
  if (field === 'aliveStatus') {
    if (!value || value.redisUnavailable || value.alive === false) return ''
    return value.uptimeFormatted || ''
  }
  if (value === null || value === undefined) return ''
  if (field === 'status') {
    return String(value).toLowerCase() === 'online' ? 'On' : 'Off'
  }
  return String(value)
}

const handleCopy = (event) => {
  if (!gridApi.value) return

  // 사용자가 텍스트 드래그/더블클릭으로 선택한 게 있으면 브라우저 기본 동작
  const sel = window.getSelection()
  if (sel && sel.toString()) return

  let copyData = ''

  // 포커스된 셀이 있으면 그 셀 값 (data field 가 있는 컬럼만 — 체크박스 컬럼 제외)
  const focused = gridApi.value.getFocusedCell()
  const focusedField = focused?.column.getColDef().field
  if (focusedField) {
    const rowNode = gridApi.value.getDisplayedRowAtIndex(focused.rowIndex)
    if (rowNode) {
      copyData = formatCellForCopy(focusedField, rowNode.data[focusedField])
    }
  }

  // 포커스 없으면 체크박스로 선택된 행 전체 (visual 컬럼 순서, 탭/줄바꿈)
  if (!copyData) {
    const selectedRows = gridApi.value.getSelectedRows()
    if (selectedRows.length > 0) {
      const fields = (gridApi.value.getAllDisplayedColumns() || [])
        .map(c => c.getColDef().field)
        .filter(Boolean)
      copyData = selectedRows.map(row =>
        fields.map(f => formatCellForCopy(f, row[f])).join('\t')
      ).join('\n')
    }
  }

  if (copyData) {
    event.preventDefault()
    event.clipboardData.setData('text/plain', copyData)
  }
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

  // TODO: Client Detail 페이지 구현 후 활성화
  // if (colId === 'eqpId') {
  //   emit('row-click', params.data)
  //   return
  // }
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
  exportColumnWidths,
})
</script>

<style>
@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
