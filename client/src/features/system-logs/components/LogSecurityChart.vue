<script setup>
import { computed } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { LineChart } from 'echarts/charts'
import { TooltipComponent, GridComponent, LegendComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { useTheme } from '@/shared/composables/useTheme'

use([LineChart, TooltipComponent, GridComponent, LegendComponent, CanvasRenderer])

const props = defineProps({
  data: { type: Array, default: () => [] },
  granularity: { type: String, default: 'hourly' }
})

const { isDark } = useTheme()

const option = computed(() => {
  const dark = isDark.value
  const isHourly = props.granularity === 'hourly'
  const isWeekly = props.granularity === 'weekly'

  // Build unique time labels
  const timeLabelSet = new Set()
  for (const item of props.data) {
    const id = item._id || {}
    const label = isHourly
      ? `${id.date || ''} ${String(id.hour ?? '').padStart(2, '0')}:00`
      : id.date || ''
    timeLabelSet.add(label)
  }
  const timeLabels = [...timeLabelSet].sort()

  // Build lookup: label -> authAction -> count
  const lookup = {}
  for (const item of props.data) {
    const id = item._id || {}
    const label = isHourly
      ? `${id.date || ''} ${String(id.hour ?? '').padStart(2, '0')}:00`
      : id.date || ''
    if (!lookup[label]) lookup[label] = {}
    lookup[label][id.authAction] = (lookup[label][id.authAction] || 0) + item.count
  }

  const loginFailedData = timeLabels.map(t => lookup[t]?.login_failed || 0)
  const permDeniedData = timeLabels.map(t => lookup[t]?.permission_denied || 0)

  return {
    tooltip: {
      trigger: 'axis',
      backgroundColor: dark ? '#1f2937' : '#fff',
      borderColor: dark ? '#374151' : '#e5e7eb',
      textStyle: { color: dark ? '#e5e7eb' : '#111827' }
    },
    legend: {
      top: 0,
      textStyle: { color: dark ? '#9ca3af' : '#6b7280' }
    },
    grid: { left: 50, right: 20, top: 40, bottom: 30 },
    xAxis: {
      type: 'category',
      data: timeLabels,
      axisLabel: {
        color: dark ? '#d1d5db' : '#374151',
        fontSize: 11,
        rotate: timeLabels.length > 12 ? 35 : 0,
        formatter: (val) => {
          if (isWeekly && val.length === 10) return val.slice(5) + '~'
          if (!isHourly && val.length === 10) return val.slice(5)
          if (isHourly && val.length > 10) return val.slice(11)
          return val
        }
      },
      axisLine: { lineStyle: { color: dark ? '#374151' : '#e5e7eb' } },
      axisTick: { show: false }
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      splitLine: { lineStyle: { color: dark ? '#374151' : '#e5e7eb' } },
      axisLabel: { color: dark ? '#9ca3af' : '#6b7280' }
    },
    series: [
      {
        name: 'Login Failed',
        type: 'line',
        data: loginFailedData,
        smooth: true,
        lineStyle: { color: '#ef4444', width: 2 },
        itemStyle: { color: '#ef4444' },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(239,68,68,0.15)' },
              { offset: 1, color: 'rgba(239,68,68,0.02)' }
            ]
          }
        }
      },
      {
        name: 'Permission Denied',
        type: 'line',
        data: permDeniedData,
        smooth: true,
        lineStyle: { color: '#f59e0b', width: 2, type: 'dashed' },
        itemStyle: { color: '#f59e0b' }
      }
    ],
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
      No security event data
    </div>
  </div>
</template>
