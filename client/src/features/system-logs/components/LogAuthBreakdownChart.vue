<script setup>
import { computed } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { BarChart } from 'echarts/charts'
import { TooltipComponent, GridComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { useChartTheme } from '@/shared/composables/useChartTheme'
import { AUTH_ACTION_COLORS } from '../constants'

use([BarChart, TooltipComponent, GridComponent, CanvasRenderer])

const props = defineProps({
  data: { type: Array, default: () => [] }
})

const { isDark, tooltipStyle, axisLabelStyle, categoryAxisLabelStyle, splitLineStyle, axisLineStyle } = useChartTheme()

const option = computed(() => {
  const dark = isDark.value
  const sorted = [...props.data].sort((a, b) => b.count - a.count)

  const categories = sorted.map(d => d._id || 'unknown')
  const values = sorted.map(d => d.count)
  const colors = sorted.map(d => AUTH_ACTION_COLORS[d._id] || (dark ? '#6b7280' : '#9ca3af'))

  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      ...tooltipStyle(dark)
    },
    grid: { left: 140, right: 40, top: 10, bottom: 20 },
    xAxis: {
      type: 'value',
      splitLine: splitLineStyle(dark),
      axisLabel: axisLabelStyle(dark)
    },
    yAxis: {
      type: 'category',
      data: categories,
      inverse: true,
      axisLabel: {
        ...categoryAxisLabelStyle(dark),
        fontSize: 11,
        width: 120,
        overflow: 'truncate'
      },
      axisLine: axisLineStyle(dark),
      axisTick: { show: false }
    },
    series: [{
      type: 'bar',
      data: values.map((v, i) => ({ value: v, itemStyle: { color: colors[i] } })),
      barMaxWidth: 24,
      label: {
        show: true,
        position: 'right',
        ...categoryAxisLabelStyle(dark),
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
