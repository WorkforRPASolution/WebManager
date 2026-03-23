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

const { isDark } = useTheme()

const ACTION_COLORS = {
  login: '#22c55e',
  logout: '#86efac',
  login_failed: '#ef4444',
  signup: '#3b82f6',
  password_change: '#f59e0b',
  password_reset_request: '#f59e0b',
  password_reset_approve: '#f59e0b',
  permission_denied: '#f97316'
}

const option = computed(() => {
  const dark = isDark.value
  const sorted = [...props.data].sort((a, b) => b.count - a.count)

  const categories = sorted.map(d => d._id || 'unknown')
  const values = sorted.map(d => d.count)
  const colors = sorted.map(d => ACTION_COLORS[d._id] || (dark ? '#6b7280' : '#9ca3af'))

  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: dark ? '#1f2937' : '#fff',
      borderColor: dark ? '#374151' : '#e5e7eb',
      textStyle: { color: dark ? '#e5e7eb' : '#111827' }
    },
    grid: { left: 140, right: 40, top: 10, bottom: 20 },
    xAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: dark ? '#374151' : '#e5e7eb' } },
      axisLabel: { color: dark ? '#9ca3af' : '#6b7280' }
    },
    yAxis: {
      type: 'category',
      data: categories,
      inverse: true,
      axisLabel: {
        color: dark ? '#d1d5db' : '#374151',
        fontSize: 11,
        width: 120,
        overflow: 'truncate'
      },
      axisLine: { lineStyle: { color: dark ? '#374151' : '#e5e7eb' } },
      axisTick: { show: false }
    },
    series: [{
      type: 'bar',
      data: values.map((v, i) => ({ value: v, itemStyle: { color: colors[i] } })),
      barMaxWidth: 24,
      label: {
        show: true,
        position: 'right',
        color: dark ? '#d1d5db' : '#374151',
        fontSize: 11,
        formatter: (p) => p.value.toLocaleString()
      }
    }],
    animationDuration: 600
  }
})
</script>

<template>
  <div class="w-full">
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
      No auth data
    </div>
  </div>
</template>
