<script setup>
import { computed } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { BarChart } from 'echarts/charts'
import { TooltipComponent, LegendComponent, GridComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { useTheme } from '../../../shared/composables/useTheme'

use([BarChart, TooltipComponent, LegendComponent, GridComponent, CanvasRenderer])

const props = defineProps({
  data: { type: Array, default: () => [] },
  groupByModel: { type: Boolean, default: false }
})

const { isDark } = useTheme()

const chartHeight = computed(() => Math.max(200, props.data.length * 36 + 80))

const option = computed(() => {
  const dark = isDark.value
  const categories = props.data.map(d =>
    props.groupByModel ? `${d.process} / ${d.eqpModel}` : d.process
  ).reverse()

  const runningData = props.data.map(d => d.runningCount).reverse()
  const stoppedData = props.data.map(d => d.stoppedCount || 0).reverse()
  const neverStartedData = props.data.map(d => d.agentCount - d.runningCount - (d.stoppedCount || 0)).reverse()

  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: dark ? '#1f2937' : '#fff',
      borderColor: dark ? '#374151' : '#e5e7eb',
      textStyle: { color: dark ? '#e5e7eb' : '#111827' }
    },
    legend: {
      top: 0,
      textStyle: { color: dark ? '#9ca3af' : '#6b7280' }
    },
    grid: {
      left: 10,
      right: 30,
      top: 32,
      bottom: 10,
      containLabel: true
    },
    xAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: dark ? '#374151' : '#e5e7eb' } },
      axisLabel: { color: dark ? '#9ca3af' : '#6b7280' }
    },
    yAxis: {
      type: 'category',
      data: categories,
      axisLabel: {
        color: dark ? '#d1d5db' : '#374151',
        fontSize: 12,
        width: 120,
        overflow: 'truncate'
      },
      axisLine: { lineStyle: { color: dark ? '#374151' : '#e5e7eb' } },
      axisTick: { show: false }
    },
    animationEasing: 'elasticOut',
    animationDuration: 1000,
    animationDelay: (idx) => idx * 80,
    series: [
      {
        name: 'Running',
        type: 'bar',
        stack: 'total',
        data: runningData,
        itemStyle: {
          color: dark ? '#4ade80' : '#22c55e',
          borderRadius: [0, 0, 0, 0]
        },
        emphasis: { itemStyle: { shadowBlur: 6, shadowColor: 'rgba(0,0,0,0.15)' } },
        barMaxWidth: 24
      },
      {
        name: 'Stopped',
        type: 'bar',
        stack: 'total',
        data: stoppedData,
        itemStyle: {
          color: dark ? '#f97316' : '#f59e0b',
          borderRadius: [0, 0, 0, 0]
        },
        emphasis: { itemStyle: { shadowBlur: 6, shadowColor: 'rgba(0,0,0,0.15)' } },
        barMaxWidth: 24
      },
      {
        name: 'Never Started',
        type: 'bar',
        stack: 'total',
        data: neverStartedData,
        itemStyle: {
          color: dark ? '#374151' : '#d1d5db',
          borderRadius: [0, 4, 4, 0]
        },
        emphasis: { itemStyle: { shadowBlur: 6, shadowColor: 'rgba(0,0,0,0.15)' } },
        barMaxWidth: 24
      }
    ]
  }
})
</script>

<template>
  <div class="w-full">
    <VChart
      v-if="data.length > 0"
      :option="option"
      autoresize
      :style="{ width: '100%', height: chartHeight + 'px' }"
    />
    <div v-else class="flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm" style="height: 200px">
      데이터가 없습니다
    </div>
  </div>
</template>
