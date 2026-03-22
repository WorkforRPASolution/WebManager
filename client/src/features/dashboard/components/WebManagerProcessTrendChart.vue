<script setup>
import { computed } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { BarChart } from 'echarts/charts'
import { TooltipComponent, GridComponent, LegendComponent, DataZoomComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { useTheme } from '../../../shared/composables/useTheme'

use([BarChart, TooltipComponent, GridComponent, LegendComponent, DataZoomComponent, CanvasRenderer])

const props = defineProps({
  data: { type: Array, default: () => [] },
  granularity: { type: String, default: 'daily' }
})

const { isDark } = useTheme()

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16']
const DARK_COLORS = ['#60A5FA', '#34D399', '#FBBF24', '#F87171', '#A78BFA', '#F472B6', '#2DD4BF', '#FB923C', '#818CF8', '#A3E635']

const MAX_VISIBLE = 24
const TOP_N = 9

function formatDateLabel(dateStr, granularity) {
  if (granularity === 'hourly') {
    const parts = dateStr.split('T')
    if (parts.length === 2) {
      const time = parts[1]
      const d = parts[0].slice(5)
      const today = new Date().toISOString().slice(5, 10)
      return d === today ? time : `${d.replace('-', '/')} ${time}`
    }
    return dateStr
  }
  if (granularity === 'weekly') {
    const d = new Date(dateStr + 'T00:00:00+09:00')
    const end = new Date(d.getTime() + 6 * 24 * 60 * 60 * 1000)
    const mm = String(end.getUTCMonth() + 1).padStart(2, '0')
    const dd = String(end.getUTCDate()).padStart(2, '0')
    return `~${mm}/${dd}`
  }
  return dateStr.slice(5).replace('-', '/')
}

const needsZoom = computed(() => (props.data || []).length > MAX_VISIBLE)

// Top N 공정 결정 (전체 합산 기준)
const topProcesses = computed(() => {
  const items = props.data || []
  const totals = {}
  for (const d of items) {
    for (const [key, val] of Object.entries(d)) {
      if (key !== 'date' && typeof val === 'number') {
        totals[key] = (totals[key] || 0) + val
      }
    }
  }
  return Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_N)
    .map(([name]) => name)
})

const option = computed(() => {
  const items = props.data || []
  if (items.length === 0) return {}

  const dark = isDark.value
  const colors = dark ? DARK_COLORS : COLORS
  const dates = items.map(d => formatDateLabel(d.date, props.granularity))
  const processes = topProcesses.value

  // 기타 키
  const allKeys = new Set()
  for (const d of items) {
    for (const key of Object.keys(d)) {
      if (key !== 'date') allKeys.add(key)
    }
  }
  const otherKeys = [...allKeys].filter(k => !processes.includes(k))

  const series = processes.map((proc, idx) => ({
    name: proc,
    type: 'bar',
    stack: 'total',
    data: items.map(d => d[proc] || 0),
    itemStyle: {
      color: colors[idx % colors.length],
      borderRadius: [0, 0, 0, 0]
    },
    emphasis: { itemStyle: { shadowBlur: 6, shadowColor: 'rgba(0,0,0,0.15)' } },
    barMaxWidth: 50
  }))

  if (otherKeys.length > 0) {
    series.push({
      name: '기타',
      type: 'bar',
      stack: 'total',
      data: items.map(d => {
        let sum = 0
        for (const k of otherKeys) sum += (d[k] || 0)
        return sum
      }),
      itemStyle: {
        color: dark ? '#4b5563' : '#d1d5db',
        borderRadius: [3, 3, 0, 0]
      },
      emphasis: { itemStyle: { shadowBlur: 6, shadowColor: 'rgba(0,0,0,0.15)' } },
      barMaxWidth: 50
    })
  }

  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: dark ? '#1f2937' : '#fff',
      borderColor: dark ? '#374151' : '#e5e7eb',
      textStyle: { color: dark ? '#e5e7eb' : '#111827' },
      formatter: (params) => {
        const date = params[0].name
        const total = params.reduce((s, p) => s + (p.value || 0), 0)
        let html = `<b>${date}</b> (${total}명, 중복 포함)<br/>`
        for (const p of params) {
          if (p.value > 0) {
            html += `${p.marker} ${p.seriesName}: <b>${p.value}</b><br/>`
          }
        }
        return html
      }
    },
    legend: {
      top: 0,
      type: 'scroll',
      textStyle: { color: dark ? '#9ca3af' : '#6b7280' },
      pageTextStyle: { color: dark ? '#9ca3af' : '#6b7280' }
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
      data: dates,
      axisLabel: {
        color: dark ? '#d1d5db' : '#374151',
        fontSize: 11,
        rotate: dates.length > 12 ? 35 : 0
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
    animationEasing: 'elasticOut',
    animationDuration: 800,
    series
  }
})
</script>

<template>
  <div class="w-full">
    <VChart
      v-if="(data || []).length > 0"
      :option="option"
      autoresize
      style="width: 100%; height: 280px"
    />
    <div v-else class="flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm" style="height: 280px">
      데이터가 없습니다
    </div>
  </div>
</template>
