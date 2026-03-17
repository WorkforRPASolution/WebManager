<script setup>
import { ref, computed } from 'vue'
import RecoveryAnalysisChart from './RecoveryAnalysisChart.vue'
import RecoveryAnalysisTrend from './RecoveryAnalysisTrend.vue'
import RecoveryAnalysisTable from './RecoveryAnalysisTable.vue'
import { exportRecoveryAnalysisCsv } from '../utils/recoveryCsvExport'

const props = defineProps({
  data: { type: Array, default: () => [] },
  trend: { type: Array, default: () => [] },
  tab: { type: String, default: 'scenario' },
  loading: { type: Boolean, default: false },
  granularity: { type: String, default: 'hourly' }
})

const emit = defineEmits(['history'])

const selectedItem = ref(null)
const selectedRows = ref([])

// groupField 이름 매핑 (탭별로 trend 데이터의 필드명이 다름)
const groupFieldMap = { scenario: 'ears_code', equipment: 'eqpid', trigger: 'trigger_by' }

const selectedTrend = computed(() => {
  if (!selectedItem.value || !props.trend.length) return []
  const field = groupFieldMap[props.tab] || 'name'
  // 전체 trend 중 선택된 항목만 필터 + bucket 기준 정렬
  return props.trend
    .filter(t => t[field] === selectedItem.value || t.name === selectedItem.value)
    .sort((a, b) => String(a.bucket).localeCompare(String(b.bucket)))
})

function handleChartSelect(name) {
  selectedItem.value = name
}

function handleRowSelect(rows) {
  selectedRows.value = rows
}

function openHistory(item) {
  emit('history', item)
}

function handleExportCsv() {
  exportRecoveryAnalysisCsv(props.data, props.tab)
}
</script>

<template>
  <div class="space-y-4">
    <!-- Loading overlay -->
    <div v-if="loading" class="flex items-center justify-center py-16">
      <svg class="w-8 h-8 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
    </div>

    <template v-else>
      <!-- Chart Row: Analysis Chart + Trend Chart -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div class="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border p-4">
          <h3 class="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-2">상태 분포</h3>
          <RecoveryAnalysisChart :data="data" @select="handleChartSelect" />
        </div>
        <div class="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border p-4">
          <h3 class="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-2">시간 추이</h3>
          <RecoveryAnalysisTrend :data="selectedTrend" :selectedItem="selectedItem" :granularity="granularity" />
        </div>
      </div>

      <!-- Table -->
      <div class="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border p-4">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-sm font-semibold text-gray-600 dark:text-gray-300">상세 테이블</h3>
          <div class="flex gap-2">
            <button
              v-if="tab !== 'trigger'"
              @click="openHistory({ name: selectedRows[0] })"
              :disabled="selectedRows.length !== 1"
              class="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg transition-colors"
              :class="selectedRows.length === 1
                ? 'text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                : 'text-gray-400 dark:text-gray-600 cursor-not-allowed opacity-50'"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              이력 조회
            </button>
            <button
              @click="handleExportCsv"
              :disabled="data.length === 0"
              class="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-border disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              CSV 내보내기
            </button>
          </div>
        </div>
        <RecoveryAnalysisTable
          :data="data"
          :tab="tab"
          :selectedRows="selectedRows"
          @select="handleRowSelect"
          @history="openHistory"
        />
      </div>
    </template>
  </div>
</template>
