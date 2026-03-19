<script setup>
import { computed } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { BarChart } from 'echarts/charts'
import { TooltipComponent, GridComponent, LegendComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { useTheme } from '@/shared/composables/useTheme'

use([BarChart, TooltipComponent, GridComponent, LegendComponent, CanvasRenderer])

const props = defineProps({
  data: { type: Array, default: () => [] }
  // Array of { _id: { date, hour, category }, count }
})

const { isDark } = useTheme()

const CATEGORIES = ['audit', 'error', 'auth', 'batch']
const COLORS = {
  audit: '#3b82f6',
  error: '#ef4444',
  auth: '#22c55e',
  batch: '#a855f7'
}

const option = computed(() => {
  const dark = isDark.value

  // Build unique time labels sorted chronologically
  const timeLabelSet = new Set()
  for (const item of props.data) {
    const id = item._id || {}
    const label = `${id.date || ''} ${String(id.hour ?? '').padStart(2, '0')}:00`
    timeLabelSet.add(label)
  }
  const timeLabels = [...timeLabelSet].sort()

  // Build lookup: "date hour" -> category -> count
  const lookup = {}
  for (const item of props.data) {
    const id = item._id || {}
    const label = `${id.date || ''} ${String(id.hour ?? '').padStart(2, '0')}:00`
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
      bottom: 30
    },
    xAxis: {
      type: 'category',
      data: timeLabels,
      axisLabel: {
        color: dark ? '#d1d5db' : '#374151',
        fontSize: 11,
        rotate: timeLabels.length > 12 ? 35 : 0
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
