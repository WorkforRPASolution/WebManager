<script setup>
import { computed } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { BarChart } from 'echarts/charts'
import { TooltipComponent, GridComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { useTheme } from '@/shared/composables/useTheme'

use([BarChart, TooltipComponent, GridComponent, CanvasRenderer])

const props = defineProps({
  data: { type: Array, default: () => [] }
})

const emit = defineEmits(['export-csv'])

const { isDark } = useTheme()

const option = computed(() => {
  const dark = isDark.value
  const sorted = [...props.data].slice(0, 10)

  const users = sorted.map(d => d._id || 'unknown')
  const values = sorted.map(d => d.count)

  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: dark ? '#1f2937' : '#fff',
      borderColor: dark ? '#374151' : '#e5e7eb',
      textStyle: { color: dark ? '#e5e7eb' : '#111827' }
    },
    grid: { left: 20, right: 20, top: 20, bottom: 50, containLabel: true },
    xAxis: {
      type: 'category',
      data: users,
      axisLabel: {
        color: dark ? '#d1d5db' : '#374151',
        fontSize: 11,
        rotate: users.length > 6 ? 35 : 0
      },
      axisLine: { lineStyle: { color: dark ? '#374151' : '#e5e7eb' } },
      axisTick: { show: false }
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: dark ? '#374151' : '#e5e7eb' } },
      axisLabel: { color: dark ? '#9ca3af' : '#6b7280' }
    },
    series: [{
      type: 'bar',
      data: values.map((v, i) => ({
        value: v,
        itemStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: i === 0 ? '#3b82f6' : '#60a5fa' },
              { offset: 1, color: i === 0 ? '#2563eb' : '#3b82f6' }
            ]
          }
        }
      })),
      barMaxWidth: 36,
      label: {
        show: true,
        position: 'top',
        color: dark ? '#d1d5db' : '#374151',
        fontSize: 11
      }
    }],
    animationDuration: 600
  }
})

function exportCsv() {
  const rows = [['User', 'Count']]
  for (const item of props.data) {
    rows.push([item._id || '', item.count || 0])
  }
  const csv = rows.map(r => r.join(',')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'top_active_users.csv'
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="w-full">
    <div class="flex justify-end mb-2">
      <button
        v-if="data.length > 0"
        @click="exportCsv"
        class="text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
      >
        CSV
      </button>
    </div>
    <VChart
      v-if="data.length > 0"
      :option="option"
      autoresize
      style="width: 100%; height: 280px"
    />
    <div
      v-else
      class="flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm"
      style="height: 280px"
    >
      No user data
    </div>
  </div>
</template>
