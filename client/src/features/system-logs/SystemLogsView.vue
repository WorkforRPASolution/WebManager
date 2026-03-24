<script setup>
import { ref, onMounted } from 'vue'
import LogFilterBar from './components/LogFilterBar.vue'
import LogTable from './components/LogTable.vue'
import LogDetailModal from './components/LogDetailModal.vue'
import LogStatistics from './components/LogStatistics.vue'
import { systemLogsApi } from '@/shared/api'
import { useToast } from '@/shared/composables/useToast'

const { showError } = useToast()

const activeTab = ref('logs')

// Logs tab state
const logs = ref([])
const pageSize = ref(50)
const pagination = ref({
  total: 0,
  page: 1,
  pageSize: 50,
  totalPages: 0,
  hasNextPage: false,
  hasPrevPage: false
})
const loading = ref(false)
const filters = ref(defaultDateRange())
const currentPage = ref(1)

function defaultDateRange() {
  const now = new Date()
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  return { startDate: start.toISOString(), endDate: now.toISOString() }
}

// Detail modal state
const selectedLog = ref(null)
const detailVisible = ref(false)

const fetchLogs = async () => {
  loading.value = true
  try {
    const { data } = await systemLogsApi.getLogs({
      ...filters.value,
      page: currentPage.value,
      pageSize: pageSize.value
    })
    logs.value = data.data
    pagination.value = data.pagination
  } catch (err) {
    showError('Failed to fetch logs')
  } finally {
    loading.value = false
  }
}

function handleSearch(newFilters) {
  filters.value = newFilters
  currentPage.value = 1
  fetchLogs()
}

function handlePageChange(page) {
  currentPage.value = page
  fetchLogs()
}

function handlePageSizeChange(size) {
  pageSize.value = size
  currentPage.value = 1
  fetchLogs()
}

function handleRowClick(row) {
  selectedLog.value = row
  detailVisible.value = true
}

function handleDetailClose() {
  detailVisible.value = false
  selectedLog.value = null
}

onMounted(fetchLogs)
</script>

<template>
  <div class="flex flex-col gap-4" style="height: calc(100vh - 144px);">
    <!-- Tab bar -->
    <div class="flex border-b border-gray-200 dark:border-dark-border">
      <button
        @click="activeTab = 'logs'"
        :class="[
          'px-4 py-2 text-sm font-medium border-b-2 transition-colors cursor-pointer',
          activeTab === 'logs'
            ? 'border-primary-500 text-primary-600 dark:text-primary-400'
            : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
        ]"
      >
        Logs
      </button>
      <button
        @click="activeTab = 'statistics'"
        :class="[
          'px-4 py-2 text-sm font-medium border-b-2 transition-colors cursor-pointer',
          activeTab === 'statistics'
            ? 'border-primary-500 text-primary-600 dark:text-primary-400'
            : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
        ]"
      >
        Statistics
      </button>
    </div>

    <!-- Logs Tab -->
    <template v-if="activeTab === 'logs'">
      <!-- Filter bar -->
      <div class="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border p-4">
        <LogFilterBar @search="handleSearch" />
      </div>

      <!-- Log table -->
      <div class="flex-1 min-h-0 bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border overflow-hidden">
        <LogTable
          :data="logs"
          :pagination="pagination"
          :loading="loading"
          @page-change="handlePageChange"
          @page-size-change="handlePageSizeChange"
          @row-click="handleRowClick"
        />
      </div>
    </template>

    <!-- Statistics Tab -->
    <template v-if="activeTab === 'statistics'">
      <div class="flex-1 min-h-0 overflow-y-auto">
        <LogStatistics />
      </div>
    </template>

    <!-- Detail Modal -->
    <LogDetailModal
      :log="selectedLog"
      :visible="detailVisible"
      @close="handleDetailClose"
    />
  </div>
</template>
