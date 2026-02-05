<template>
  <div class="flex flex-col w-full h-full">
    <div ref="gridContainer" class="flex-1 min-h-0 ag-grid-custom-scrollbar" @keydown.capture="handleKeyDown" @copy="handleCopy" @paste="handlePaste" tabindex="0">
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
        @cell-double-clicked="onCellDoubleClicked"
        @cell-editing-started="onCellEditingStarted"
        @cell-editing-stopped="onCellEditingStopped"
        @cell-value-changed="onCellValueChanged"
        @sort-changed="onSortChanged"
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
import { ref, computed, watch, onMounted } from 'vue'
import { AgGridVue } from 'ag-grid-vue3'
import { ModuleRegistry, AllCommunityModule, themeQuartz } from 'ag-grid-community'
import { useTheme } from '../../../shared/composables/useTheme'
import { useCustomScrollbar } from '../../../shared/composables/useCustomScrollbar'
import { useDataGridCellSelection } from '../../../shared/composables/useDataGridCellSelection'
import CustomHorizontalScrollbar from '../../../shared/components/CustomHorizontalScrollbar.vue'

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule])

const { isDark } = useTheme()

// AG Grid Theme
const lightTheme = themeQuartz.withParams({
  fontSize: 12,
  spacing: 6,
  rowHeight: 60,
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
  rowHeight: 60,
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
  editable: {
    type: Boolean,
    default: false
  },
  modifiedCells: {
    type: Map,
    default: () => new Map()
  }
})

const emit = defineEmits(['selection-change', 'preview-image', 'cell-value-changed', 'paste-cells'])

const gridContainer = ref(null)
const gridApi = ref(null)

// Shift+클릭 행 범위 선택을 위한 마지막 선택 행
const lastSelectedRowIndex = ref(null)

// 편집 가능한 컬럼 목록
const editableColumns = ['process', 'model', 'code', 'subcode']

// Custom Scrollbar
const { scrollState, scrollTo, handleColumnChange } = useCustomScrollbar(gridContainer)

const handleCustomScroll = (scrollLeft) => {
  scrollTo(scrollLeft)
}

// rowId 추출 함수 (EmailImage는 prefix_name 형식)
const getRowIdFromData = (data) => `${data.prefix}_${data.name}`

// 셀 범위 선택 Composable (편집 권한이 있을 때만 사용)
const {
  cellSelectionStart,
  cellSelectionEnd,
  handleCellClicked: baseCellClicked,
  handleCellEditingStarted: onCellEditingStarted,
  handleCellEditingStopped: onCellEditingStopped,
  handleKeyDown,
  handleSortChanged: onSortChanged,
  handleCopy,
  handlePaste,
  getCellSelectionStyle,
  clearSelection,
  setupHeaderClickHandler,
  setupRowDataWatcher,
  setupSelectionWatcher,
} = useDataGridCellSelection({
  gridApi,
  gridContainer,
  editableColumns,
  getRowId: getRowIdFromData,
  onBulkEdit: (updates) => {
    // 일괄 편집 시 각 업데이트에 대해 cell-value-changed emit
    for (const update of updates) {
      const row = props.rowData.find(r => getRowIdFromData(r) === update.rowId)
      if (row) {
        row[update.field] = update.value
        if (!row.originalPrefix) {
          row.originalPrefix = row.prefix
        }
        emit('cell-value-changed', row, update.field)
      }
    }
  },
  onCellEdit: (rowId, field, value) => {
    const row = props.rowData.find(r => getRowIdFromData(r) === rowId)
    if (row) {
      row[field] = value
      if (!row.originalPrefix) {
        row.originalPrefix = row.prefix
      }
      emit('cell-value-changed', row, field)
    }
  },
  onPasteCells: (cellUpdates) => {
    emit('paste-cells', cellUpdates)
  },
})

// Setup watchers and handlers
onMounted(() => {
  if (props.editable) {
    setupHeaderClickHandler()
  }
})

setupRowDataWatcher(() => props.rowData)
setupSelectionWatcher()

// Format file size
const formatFileSize = (bytes) => {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// Format date
const formatDate = (dateStr) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// Row selection config
const rowSelection = ref({
  mode: 'multiRow',
  checkboxes: true,
  headerCheckbox: true,
  enableClickSelection: false,
})

// Cell style function
const getCellStyle = (params) => {
  const rowIndex = params.rowIndex
  const colId = params.colDef.field

  // Check for cell range selection
  if (props.editable) {
    const selectionStyle = getCellSelectionStyle(rowIndex, colId)
    if (selectionStyle) return selectionStyle
  }

  // Editable cell visual feedback
  if (props.editable && editableColumns.includes(colId)) {
    return {
      backgroundColor: isDark.value ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.05)',
      cursor: 'text'
    }
  }

  return null
}

// Cell class function - apply 'cell-value-changed' class to modified cells
const getCellClass = (params) => {
  if (!props.modifiedCells) return null

  const rowId = getRowIdFromData(params.data)
  const field = params.colDef.field

  // Check if this cell has been modified
  const cellFields = props.modifiedCells.get(rowId)
  if (cellFields && cellFields.has(field)) {
    return 'cell-value-changed'
  }
  return null
}

const columnDefs = computed(() => [
  {
    field: 'thumbnail',
    headerName: '',
    width: 70,
    sortable: false,
    filter: false,
    cellRenderer: (params) => {
      const url = params.data?.url
      if (!url) return ''
      return `<div class="flex items-center justify-center h-full">
        <img src="${url}" alt="thumbnail" class="w-12 h-12 object-cover rounded cursor-pointer hover:opacity-80 transition-opacity" title="Double-click to preview" />
      </div>`
    },
    tooltipValueGetter: () => 'Double-click to preview'
  },
  {
    field: 'process',
    headerName: 'Process',
    width: 100,
    editable: props.editable,
  },
  {
    field: 'model',
    headerName: 'Model',
    width: 100,
    editable: props.editable,
  },
  {
    field: 'code',
    headerName: 'Code',
    width: 100,
    editable: props.editable,
  },
  {
    field: 'subcode',
    headerName: 'Subcode',
    width: 100,
    editable: props.editable,
  },
  { field: 'filename', headerName: 'Filename', width: 200 },
  {
    field: 'size',
    headerName: 'Size',
    width: 100,
    valueFormatter: (params) => formatFileSize(params.value)
  },
  {
    field: 'createdAt',
    headerName: 'Uploaded',
    width: 160,
    valueFormatter: (params) => formatDate(params.value)
  },
])

const defaultColDef = ref({
  sortable: true,
  resizable: true,
  filter: true,
  cellStyle: params => getCellStyle(params),
  cellClass: params => getCellClass(params),
})

const getRowId = (params) => {
  return `${params.data.prefix}_${params.data.name}`
}

const onGridReady = (params) => {
  gridApi.value = params.api
  handleColumnChange()
}

const onSelectionChanged = () => {
  if (!gridApi.value) return
  const selectedRows = gridApi.value.getSelectedRows()
  const selectedItems = selectedRows.map(row => ({
    prefix: row.prefix,
    name: row.name
  }))
  emit('selection-change', selectedItems)
}

// Shift+클릭으로 체크박스 범위 선택 및 셀 범위 선택
const onCellClicked = (params) => {
  const colId = params.colDef.field
  const rowIndex = params.rowIndex
  console.log('[EmailImageGrid] onCellClicked - colId:', colId, 'rowIndex:', rowIndex, 'editable:', props.editable)

  // 체크박스 컬럼 클릭 처리
  if (params.column.colId === 'ag-Grid-SelectionColumn') {
    if (params.event.shiftKey && lastSelectedRowIndex.value !== null) {
      // Shift+클릭: 범위 선택
      const start = Math.min(lastSelectedRowIndex.value, rowIndex)
      const end = Math.max(lastSelectedRowIndex.value, rowIndex)

      for (let i = start; i <= end; i++) {
        const node = gridApi.value.getDisplayedRowAtIndex(i)
        node?.setSelected(true)
      }
    } else {
      // 일반 클릭: 마지막 선택 행 업데이트
      lastSelectedRowIndex.value = rowIndex
    }
    // 셀 범위 선택 초기화
    cellSelectionStart.value = null
    cellSelectionEnd.value = null
    return
  }

  // 나머지 셀 클릭은 composable에 위임 (편집 가능할 때만)
  if (props.editable) {
    // 편집 가능한 컬럼인지 확인
    if (editableColumns.includes(colId)) {
      if (params.event.shiftKey && cellSelectionStart.value) {
        // Shift+클릭: 셀 범위 선택
        cellSelectionEnd.value = { rowIndex, colId }
      } else {
        // 일반 클릭: 단일 셀 선택 (start와 end 모두 같은 셀로 설정 - 복사 지원)
        cellSelectionStart.value = { rowIndex, colId }
        cellSelectionEnd.value = { rowIndex, colId }
      }
    } else {
      // 편집 불가능한 컬럼 클릭 시 선택 해제
      cellSelectionStart.value = null
      cellSelectionEnd.value = null
    }
  }
}

const onCellDoubleClicked = (params) => {
  if (params.colDef.field === 'thumbnail') {
    emit('preview-image', params.data)
  }
}

const onCellValueChanged = (params) => {
  // Only emit for editable fields
  if (editableColumns.includes(params.colDef.field)) {
    // Store original prefix if not already stored
    if (!params.data.originalPrefix) {
      params.data.originalPrefix = params.data.prefix
    }
    emit('cell-value-changed', params.data, params.colDef.field)
  }
}

// Watch for modifiedCells changes to update cell styling
watch(() => props.modifiedCells, () => {
  if (gridApi.value) {
    gridApi.value.redrawRows()
  }
}, { deep: true })

// Expose methods
defineExpose({
  getSelectedRows: () => gridApi.value?.getSelectedRows() || [],
  clearSelection: () => {
    gridApi.value?.deselectAll()
    clearSelection()
  },
  refreshCells: () => gridApi.value?.refreshCells({ force: true }),
})
</script>
