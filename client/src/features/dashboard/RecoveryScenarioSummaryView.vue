<script setup>
import { ref, watch, onMounted } from 'vue'
import { AgGridVue } from 'ag-grid-vue3'
import { ModuleRegistry, AllCommunityModule, themeQuartz } from 'ag-grid-community'
import { recoveryApi, clientsApi } from '../../shared/api'
import { useProcessFilterStore } from '../../shared/stores/processFilter'
import { useProcessPermission } from '../../shared/composables/useProcessPermission'
import { useToast } from '../../shared/composables/useToast'
import { useTheme } from '../../shared/composables/useTheme'
import { useCustomScrollbar } from '../../shared/composables/useCustomScrollbar'
import RecoveryFilterBar from './components/RecoveryFilterBar.vue'
import BaseDataGridToolbar from '../../shared/components/BaseDataGridToolbar.vue'
import CustomHorizontalScrollbar from '../../shared/components/CustomHorizontalScrollbar.vue'
import { exportRecoveryScenarioSummaryCsv } from './utils/recoveryCsvExport'

ModuleRegistry.registerModules([AllCommunityModule])

const { isDark } = useTheme()
const { showError, showWarning } = useToast()
const processFilterStore = useProcessFilterStore()
const { buildUserProcessFilter } = useProcessPermission()

// ── AG Grid theme ──
const lightTheme = themeQuartz.withParams({
  fontSize: 12, spacing: 6, rowHeight: 36, headerHeight: 40,
  borderRadius: 0, wrapperBorderRadius: 0,
  backgroundColor: '#ffffff', headerBackgroundColor: '#f8fafc',
  borderColor: '#e2e8f0', foregroundColor: '#1e293b',
})
const darkTheme = themeQuartz.withParams({
  fontSize: 12, spacing: 6, rowHeight: 36, headerHeight: 40,
  borderRadius: 0, wrapperBorderRadius: 0,
  backgroundColor: '#1e293b', headerBackgroundColor: '#0f172a',
  borderColor: '#334155', foregroundColor: '#e2e8f0',
  oddRowBackgroundColor: '#1e293b', rowHoverColor: '#334155',
})
const gridTheme = ref(isDark.value ? darkTheme : lightTheme)
const gridContainer = ref(null)
const gridApi = ref(null)

// ── Custom scrollbar ──
const { scrollState, scrollTo, handleColumnChange } = useCustomScrollbar(gridContainer)
function handleCustomScroll(scrollLeft) { scrollTo(scrollLeft) }
function onGridReady(params) { gridApi.value = params.api; handleColumnChange() }

// ── State ──
const processes = ref([])
const rowData = ref([])
const loading = ref(false)
const exporting = ref(false)
const hasSearched = ref(false)
const currentFilters = ref({ period: '30d' })
const currentPage = ref(1)
const pageSize = ref(50)
const totalRecords = ref(0)
const totalPages = ref(0)

// ── Column definitions ──
const defaultColDef = {
  resizable: true,
  sortable: false,
  suppressMovable: true,
  suppressSizeToFit: true,
}

const columnDefs = ref([
  { field: 'process',      headerName: 'Process',       width: 120, minWidth: 80 },
  { field: 'model',        headerName: 'Model',         width: 120, minWidth: 80 },
  { field: 'ears_code',    headerName: 'EARS Code',     width: 200, minWidth: 120 },
  { field: 'categoryName', headerName: 'Category',      width: 150, minWidth: 100,
    valueFormatter: p => p.value || '-' },
  { field: 'total',        headerName: 'Total',         width: 90,  minWidth: 60,  type: 'numericColumn' },
  { field: 'success',      headerName: 'Success',       width: 90,  minWidth: 60,  type: 'numericColumn' },
  { field: 'fail',         headerName: 'Fail',          width: 90,  minWidth: 60,  type: 'numericColumn' },
  { field: 'lastModifier', headerName: 'Last Modifier', width: 220, minWidth: 140,
    valueFormatter: p => p.value || '-' },
])

// ── Data fetching ──
async function fetchData(filters, page = 1, size = pageSize.value) {
  loading.value = true
  try {
    const queryFilters = { ...filters }
    if (!queryFilters.process) {
      const userProcesses = buildUserProcessFilter()
      if (userProcesses) queryFilters.process = userProcesses.join(',')
    }
    const res = await recoveryApi.getScenarioSummary({ ...queryFilters, page, pageSize: size })
    rowData.value = res.data.data || []
    const p = res.data.pagination
    totalRecords.value = p.total
    totalPages.value = p.totalPages
    currentPage.value = p.page
    pageSize.value = p.pageSize
    hasSearched.value = true
  } catch (err) {
    showError('데이터 로드에 실패했습니다')
  } finally {
    loading.value = false
  }
}

async function loadFilterOptions() {
  try {
    const res = await clientsApi.getProcesses()
    const allProcesses = res.data || []
    processFilterStore.setProcesses('clients', allProcesses)
    processes.value = processFilterStore.getFilteredProcesses('clients')
      .map(p => typeof p === 'string' ? p : p.value)
  } catch {
    // 필터 옵션 로드 실패는 무시
  }
}

// ── Events ──
function handleSearch(filters) {
  currentFilters.value = filters
  fetchData(filters, 1)
}

function handlePageChange(page) {
  fetchData(currentFilters.value, page)
}

function handlePageSizeChange(size) {
  pageSize.value = size
  fetchData(currentFilters.value, 1, size)
}

async function handleExport() {
  exporting.value = true
  try {
    const queryFilters = { ...currentFilters.value }
    if (!queryFilters.process) {
      const userProcesses = buildUserProcessFilter()
      if (userProcesses) queryFilters.process = userProcesses.join(',')
    }
    const res = await recoveryApi.exportScenarioSummary(queryFilters)
    if (res.data.truncated) {
      showWarning(`데이터가 많아 최대 ${res.data.limit.toLocaleString()}건만 내보냈습니다.`)
    }
    exportRecoveryScenarioSummaryCsv(res.data.data)
  } catch {
    showError('CSV 내보내기에 실패했습니다')
  } finally {
    exporting.value = false
  }
}

// ── Theme watch ──
watch(isDark, (dark) => { gridTheme.value = dark ? darkTheme : lightTheme })

onMounted(() => { loadFilterOptions() })
</script>

<template>
  <div class="flex flex-col gap-4" style="height: calc(100vh - 144px);">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Recovery Scenario Summary</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">시나리오별 Recovery 실적 집계 (Admin 전용)</p>
      </div>
      <!-- CSV Export -->
      <button
        v-if="hasSearched"
        @click="handleExport"
        :disabled="exporting || loading"
        class="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-border transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <svg v-if="!exporting" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <svg v-else class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
        CSV
      </button>
    </div>

    <!-- Filter Bar -->
    <div class="bg-white dark:bg-dark-card rounded-xl p-4 shadow-sm border border-gray-200 dark:border-dark-border">
      <RecoveryFilterBar
        :processes="processes"
        :loading="loading"
        @search="handleSearch"
      />
    </div>

    <!-- Toolbar (페이지네이션) -->
    <BaseDataGridToolbar
      :has-changes="false"
      :can-write="false"
      :can-delete="false"
      :total-count="totalRecords"
      :page-size="pageSize"
      :current-page="currentPage"
      :total-pages="totalPages"
      :page-size-options="[10, 25, 50, 75, 100]"
      @page-size-change="handlePageSizeChange"
      @page-change="handlePageChange"
    />

    <!-- Loading state -->
    <div v-if="loading" class="flex-1 flex items-center justify-center">
      <div class="flex items-center gap-3 text-gray-500 dark:text-gray-400">
        <svg class="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
        <span>데이터를 불러오는 중...</span>
      </div>
    </div>

    <!-- Empty / not-searched state -->
    <div v-else-if="!hasSearched" class="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-500">
      <div class="text-center">
        <svg class="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p class="text-sm">기간과 프로세스를 선택하고 조회 버튼을 눌러주세요.</p>
      </div>
    </div>

    <!-- No data -->
    <div v-else-if="rowData.length === 0" class="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-500">
      <p class="text-sm">조회된 데이터가 없습니다.</p>
    </div>

    <!-- AG Grid -->
    <div v-else class="flex-1 min-h-0 flex flex-col">
      <div ref="gridContainer" class="flex-1 min-h-0 ag-grid-custom-scrollbar" tabindex="0">
        <AgGridVue
          :theme="gridTheme"
          :rowData="rowData"
          :columnDefs="columnDefs"
          :defaultColDef="defaultColDef"
          :alwaysShowHorizontalScroll="true"
          :suppressSizeToFit="true"
          :enableCellTextSelection="true"
          @grid-ready="onGridReady"
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
  </div>
</template>
