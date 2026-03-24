<script setup>
import { computed } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { BarChart } from 'echarts/charts'
import { TooltipComponent, GridComponent, LegendComponent, DataZoomComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { useTheme } from '@/shared/composables/useTheme'

use([BarChart, TooltipComponent, GridComponent, LegendComponent, DataZoomComponent, CanvasRenderer])

const props = defineProps({
  data: { type: Array, default: () => [] },
  // M4: granularity from server ('hourly', 'daily', or 'weekly')
  granularity: { type: String, default: 'hourly' }
})

const MAX_VISIBLE = 25

const { isDark } = useTheme()

const CATEGORIES = ['audit', 'error', 'auth', 'batch', 'access', 'eqp-redis']
const COLORS = {
  audit: '#3b82f6',
  error: '#ef4444',
  auth: '#22c55e',
  batch: '#a855f7',
  access: '#f59e0b',
  'eqp-redis': '#f97316'
}

const option = computed(() => {
  const dark = isDark.value
  const isHourly = props.granularity === 'hourly'
  const isWeekly = props.granularity === 'weekly'

  // Build unique time labels sorted chronologically
  const timeLabelSet = new Set()
  for (const item of props.data) {
    const id = item._id || {}
    const label = isHourly
      ? `${id.date || ''} ${String(id.hour ?? '').padStart(2, '0')}:00`
      : id.date || ''
    timeLabelSet.add(label)
  }
  const timeLabels = [...timeLabelSet].sort()

  // Build lookup: label -> category -> count
  const lookup = {}
  for (const item of props.data) {
    const id = item._id || {}
    const label = isHourly
      ? `${id.date || ''} ${String(id.hour ?? '').padStart(2, '0')}:00`
      : id.date || ''
    if (!lookup[label]) lookup[label] = {}
    lookup[label][id.category] = (lookup[label][id.category] || 0) + item.count
  }

  const series = CATEGORIES.map(cat => ({
    name: cat,
    type: 'bar',
    stack: 'total',
    data: timeLabels.map(t => (lookup[t] && lookup[t][cat]) || 0),
    itemStyle: { color: COLORS[cat] },
    barMaxWidth: 40,
    emphasis: { itemStyle: { shadowBlur: 6, shadowColor: 'rgba(0,0,0,0.15)' } }
  }))

  // dataZoom for long ranges
  const needsZoom = timeLabels.length > MAX_VISIBLE
  const zoomEnd = needsZoom ? Math.round(MAX_VISIBLE / timeLabels.length * 100) : 100
  const bottomMargin = needsZoom ? 60 : 30

  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: dark ? '#1f2937' : '#fff',
      borderColor: dark ? '#374151' : '#e5e7eb',
      textStyle: { color: dark ? '#e5e7eb' : '#111827' },
      formatter: (params) => {
        const title = params[0]?.axisValueLabel || ''
        const items = params
          .filter(p => p.value > 0)
          .map(p => `${p.marker} ${p.seriesName}: <b>${p.value}</b>`)
        if (items.length === 0) return `<b>${title}</b><br/>No data`
        return `<b>${title}</b><br/>${items.join('<br/>')}`
      }
    },
    legend: {
      top: 0,
      textStyle: { color: dark ? '#9ca3af' : '#6b7280' }
    },
    grid: {
      left: 50,
      right: 20,
      top: 40,
      bottom: bottomMargin
    },
    dataZoom: needsZoom ? [{
      type: 'slider',
      start: 0,
      end: zoomEnd,
      bottom: 5,
      height: 20,
      borderColor: dark ? '#374151' : '#e5e7eb',
      backgroundColor: dark ? '#1f2937' : '#f3f4f6',
      fillerColor: dark ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.1)',
      textStyle: { color: dark ? '#9ca3af' : '#6b7280', fontSize: 10 }
    }] : [],
    xAxis: {
      type: 'category',
      data: timeLabels,
      axisLabel: {
        color: dark ? '#d1d5db' : '#374151',
        fontSize: 11,
        rotate: timeLabels.length > 12 ? 35 : 0,
        formatter: (val) => {
          // For weekly, show "MM-DD~"
          if (isWeekly && val.length === 10) return val.slice(5) + '~'
          // For daily, show shorter date format
          if (!isHourly && val.length === 10) return val.slice(5)
          // For hourly, show HH:00 only (date in tooltip)
          if (isHourly && val.length > 10) return val.slice(11)
          return val
        }
      },
      axisLine: { lineStyle: { color: dark ? '#374151' : '#e5e7eb' } },
      axisTick: { show: false }
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: dark ? '#374151' : '#e5e7eb' } },
      axisLabel: { color: dark ? '#9ca3af' : '#6b7280' }
    },
    animationEasing: 'elasticOut',
    animationDuration: 800,
    series
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
    <div
      v-else
      class="flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm"
      style="height: 320px"
    >
      No trend data
    </div>
  </div>
</template>
