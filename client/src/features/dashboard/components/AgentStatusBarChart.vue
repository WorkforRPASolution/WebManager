<script setup>
import { computed } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { BarChart } from 'echarts/charts'
import { TooltipComponent, LegendComponent, GridComponent, DataZoomComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { useTheme } from '../../../shared/composables/useTheme'

use([BarChart, TooltipComponent, LegendComponent, GridComponent, DataZoomComponent, CanvasRenderer])

const props = defineProps({
  data: { type: Array, default: () => [] },
  groupByModel: { type: Boolean, default: false }
})

const { isDark } = useTheme()

const MAX_VISIBLE = 25
const needsZoom = computed(() => props.data.length > MAX_VISIBLE)

const option = computed(() => {
  const dark = isDark.value
  const categories = props.data.map(d =>
    props.groupByModel ? `${d.process} / ${d.eqpModel}` : d.process
  )

  const runningData = props.data.map(d => d.runningCount)
  const stoppedData = props.data.map(d => d.stoppedCount || 0)
  const neverStartedData = props.data.map(d => d.agentCount - d.runningCount - (d.stoppedCount || 0))

  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: dark ? '#1f2937' : '#fff',
      borderColor: dark ? '#374151' : '#e5e7eb',
      textStyle: { color: dark ? '#e5e7eb' : '#111827' },
      formatter: (params) => {
        const title = params[0]?.axisValueLabel || ''
        const items = params.filter(p => p.value > 0)
        if (items.length === 0) return `${title}<br/>데이터 없음`
        const lines = items.map(p => `${p.marker} ${p.seriesName}: <b>${p.value}</b>`).join('<br/>')
        const total = items.reduce((s, p) => s + p.value, 0)
        return `<b>${title}</b> (${total})<br/>${lines}`
      }
    },
    legend: {
      top: 0,
      textStyle: { color: dark ? '#9ca3af' : '#6b7280' }
    },
    grid: {
      left: 10,
      right: 20,
      top: 32,
      bottom: needsZoom.value ? 50 : 10,
      containLabel: true
    },
    ...(needsZoom.value ? {
      dataZoom: [{
        type: 'slider',
        xAxisIndex: 0,
        bottom: 5,
        height: 16,
        startValue: 0,
        endValue: MAX_VISIBLE - 1,
        minValueSpan: Math.min(MAX_VISIBLE - 1, categories.length - 1),
        brushSelect: false,
        handleSize: '60%',
        borderColor: 'transparent',
        fillerColor: dark ? 'rgba(99,102,241,0.3)' : 'rgba(59,130,246,0.2)',
        handleStyle: { color: dark ? '#6366f1' : '#3b82f6', borderColor: dark ? '#6366f1' : '#3b82f6' },
        textStyle: { color: 'transparent' }
      }]
    } : {}),
    xAxis: {
      type: 'category',
      data: categories,
      triggerEvent: true,
      axisLabel: {
        color: dark ? '#d1d5db' : '#374151',
        fontSize: 11,
        rotate: categories.length > 8 ? 35 : 0,
        overflow: 'truncate',
        width: 70
      },
      axisLine: { lineStyle: { color: dark ? '#374151' : '#e5e7eb' } },
      axisTick: { show: false },
      axisPointer: {
        type: 'shadow',
        label: {
          show: true,
          backgroundColor: dark ? '#374151' : '#111827',
          color: '#fff',
          fontSize: 12,
          padding: [4, 8]
        }
      }
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: dark ? '#374151' : '#e5e7eb' } },
      axisLabel: { color: dark ? '#9ca3af' : '#6b7280' }
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
        barMaxWidth: 100
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
        barMaxWidth: 100
      },
      {
        name: 'Never Started',
        type: 'bar',
        stack: 'total',
        data: neverStartedData,
        itemStyle: {
          color: dark ? '#374151' : '#d1d5db',
          borderRadius: [4, 4, 0, 0]
        },
        emphasis: { itemStyle: { shadowBlur: 6, shadowColor: 'rgba(0,0,0,0.15)' } },
        barMaxWidth: 100
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
      style="width: 100%; height: 320px"
    />
    <div v-else class="flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm" style="height: 200px">
      데이터가 없습니다
    </div>
  </div>
</template>
