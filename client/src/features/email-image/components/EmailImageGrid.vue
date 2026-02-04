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
        @cell-double-clicked="onCellDoubleClicked"
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
import { ref, computed, h } from 'vue'
import { AgGridVue } from 'ag-grid-vue3'
import { ModuleRegistry, AllCommunityModule, themeQuartz } from 'ag-grid-community'
import { useTheme } from '../../../shared/composables/useTheme'
import { useCustomScrollbar } from '../../../shared/composables/useCustomScrollbar'
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
  }
})

const emit = defineEmits(['selection-change', 'preview-image'])

const gridContainer = ref(null)
const gridApi = ref(null)

// Custom Scrollbar
const { scrollState, scrollTo, handleColumnChange } = useCustomScrollbar(gridContainer)

const handleCustomScroll = (scrollLeft) => {
  scrollTo(scrollLeft)
}

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

const columnDefs = ref([
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
  { field: 'process', headerName: 'Process', width: 100 },
  { field: 'model', headerName: 'Model', width: 100 },
  { field: 'code', headerName: 'Code', width: 100 },
  { field: 'subcode', headerName: 'Subcode', width: 100 },
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

const onCellDoubleClicked = (params) => {
  if (params.colDef.field === 'thumbnail') {
    emit('preview-image', params.data)
  }
}

// Expose methods
defineExpose({
  getSelectedRows: () => gridApi.value?.getSelectedRows() || [],
  clearSelection: () => gridApi.value?.deselectAll(),
  refreshCells: () => gridApi.value?.refreshCells({ force: true }),
})
</script>
