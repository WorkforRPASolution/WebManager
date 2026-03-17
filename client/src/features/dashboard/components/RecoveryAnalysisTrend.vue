<script setup>
import { computed } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { LineChart } from 'echarts/charts'
import { TooltipComponent, LegendComponent, GridComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { useTheme } from '../../../shared/composables/useTheme'
import { getStatusColor } from '../utils/recoveryColors'

use([LineChart, TooltipComponent, LegendComponent, GridComponent, CanvasRenderer])

const props = defineProps({
  data: { type: Array, default: () => [] },
  selectedItem: { type: String, default: '' }
})

const { isDark } = useTheme()

const trendStatuses = ['Success', 'Failed', 'Stopped', 'Skip']

const option = computed(() => {
  const dark = isDark.value
  const items = props.data

  const xData = items.map(d => d.bucket || '')

  const series = trendStatuses.map(status => ({
    name: status,
    type: 'line',
    smooth: true,
    symbol: 'circle',
    symbolSize: 6,
    data: items.map(d => (d.statusCounts && d.statusCounts[status]) || 0),
    lineStyle: {
      width: 2,
      color: getStatusColor(status, dark)
    },
    itemStyle: {
      color: getStatusColor(status, dark)
    },
    areaStyle: {
      color: {
        type: 'linear',
        x: 0, y: 0, x2: 0, y2: 1,
        colorStops: [
          { offset: 0, color: getStatusColor(status, dark) + '40' },
          { offset: 1, color: getStatusColor(status, dark) + '05' }
        ]
      }
    }
  }))

  return {
    title: {
      text: props.selectedItem ? `Trend: ${props.selectedItem}` : '',
      left: 'center',
      top: 0,
      textStyle: {
        fontSize: 13,
        fontWeight: 600,
        color: dark ? '#e5e7eb' : '#374151'
      }
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: dark ? '#1f2937' : '#fff',
      borderColor: dark ? '#374151' : '#e5e7eb',
      textStyle: { color: dark ? '#e5e7eb' : '#111827' },
      formatter: (params) => {
        const title = params[0]?.axisValueLabel || ''
        const lines = params.filter(p => p.value > 0)
          .map(p => `${p.marker} ${p.seriesName}: <b>${p.value}</b>`)
          .join('<br/>')
        return `<b>${title}</b><br/>${lines || '데이터 없음'}`
      }
    },
    legend: {
      top: props.selectedItem ? 24 : 0,
      textStyle: { color: dark ? '#9ca3af' : '#6b7280' }
    },
    grid: {
      left: 10,
      right: 20,
      top: props.selectedItem ? 56 : 32,
      bottom: 10,
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: xData,
      axisLabel: {
        color: dark ? '#d1d5db' : '#374151',
        fontSize: 11,
        rotate: xData.length > 12 ? 30 : 0
      },
      axisLine: { lineStyle: { color: dark ? '#374151' : '#e5e7eb' } },
      axisTick: { show: false }
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: dark ? '#374151' : '#e5e7eb' } },
      axisLabel: { color: dark ? '#9ca3af' : '#6b7280' }
    },
    animationDuration: 800,
    series
  }
})
</script>

<template>
  <div class="w-full">
    <template v-if="selectedItem && data.length > 0">
      <VChart
        :option="option"
        autoresize
        style="width: 100%; height: 400px"
      />
    </template>
    <div v-else class="flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm" style="height: 400px">
      <div class="text-center">
        <svg class="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
        </svg>
        <p>차트에서 항목을 클릭하세요</p>
      </div>
    </div>
  </div>
</template>
