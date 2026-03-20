<script setup>
import { computed } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { BarChart } from 'echarts/charts'
import { TooltipComponent, GridComponent, LegendComponent, DataZoomComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { useTheme } from '../../../shared/composables/useTheme'

use([BarChart, TooltipComponent, GridComponent, LegendComponent, DataZoomComponent, CanvasRenderer])

const MAX_VISIBLE = 25

const props = defineProps({
  data: { type: Array, default: () => [] }
})

const { isDark } = useTheme()

const needsZoom = computed(() => props.data.length > MAX_VISIBLE)

const option = computed(() => {
  const dark = isDark.value
  const items = props.data
  const names = items.map(d => d.process)
  const activeValues = items.map(d => d.activeUsers)
  const inactiveValues = items.map(d => d.totalUsers - d.activeUsers)

  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: dark ? '#1f2937' : '#fff',
      borderColor: dark ? '#374151' : '#e5e7eb',
      textStyle: { color: dark ? '#e5e7eb' : '#111827' },
      formatter: (params) => {
        const name = params[0].name
        const item = items.find(d => d.process === name)
        if (!item) return name
        return `<b>${name}</b><br/>` +
          `Active: <b>${item.activeUsers}</b><br/>` +
          `Inactive: <b>${item.totalUsers - item.activeUsers}</b><br/>` +
          `사용률: <b>${item.usageRate.toFixed(1)}%</b>`
      }
    },
    legend: {
      bottom: needsZoom.value ? 30 : 0,
      textStyle: { color: dark ? '#9ca3af' : '#6b7280' }
    },
    grid: {
      left: 10,
      right: 10,
      top: 20,
      bottom: needsZoom.value ? 70 : 40,
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
        minValueSpan: Math.min(MAX_VISIBLE - 1, names.length - 1),
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
      data: names,
      axisLabel: {
        color: dark ? '#d1d5db' : '#374151',
        fontSize: 11,
        rotate: names.length > 8 ? 35 : 0,
        overflow: 'truncate',
        width: 60
      },
      axisLine: { lineStyle: { color: dark ? '#374151' : '#e5e7eb' } },
      axisTick: { show: false }
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: dark ? '#374151' : '#e5e7eb' } },
      axisLabel: { color: dark ? '#9ca3af' : '#6b7280', fontSize: 10 }
    },
    animationEasing: 'elasticOut',
    animationDuration: 800,
    animationDelay: (idx) => idx * 80,
    series: [
      {
        name: 'Active',
        type: 'bar',
        stack: 'total',
        data: activeValues,
        itemStyle: {
          color: dark ? '#60a5fa' : '#3b82f6',
          borderRadius: [0, 0, 0, 0]
        },
        barMaxWidth: 40
      },
      {
        name: 'Inactive',
        type: 'bar',
        stack: 'total',
        data: inactiveValues,
        itemStyle: {
          color: dark ? '#374151' : '#e5e7eb',
          borderRadius: [3, 3, 0, 0]
        },
        barMaxWidth: 40
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
