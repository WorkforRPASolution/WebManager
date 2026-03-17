<script setup>
import { computed } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { LineChart } from 'echarts/charts'
import { TooltipComponent, LegendComponent, GridComponent, DataZoomComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { useTheme } from '../../../shared/composables/useTheme'

use([LineChart, TooltipComponent, LegendComponent, GridComponent, DataZoomComponent, CanvasRenderer])

const props = defineProps({
  data: { type: Array, default: () => [] },
  topCount: { type: Number, default: 5 }
})

const { isDark } = useTheme()

// Distinct colors for top N processes
const TOP_COLORS = [
  '#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#6366f1'
]

/**
 * Transform flat trend array [{ bucket, process, total, statusCounts }]
 * into per-process grouped format [{ process, trend: [{ bucket, successRate }] }]
 */
function groupByProcess(flatData) {
  const map = new Map()
  for (const item of flatData) {
    if (!map.has(item.process)) {
      map.set(item.process, [])
    }
    const sc = item.statusCounts || {}
    const total = item.total || 0
    const success = sc.Success || 0
    const successRate = total > 0 ? Math.round((success / total) * 1000) / 10 : 0
    map.get(item.process).push({ bucket: item.bucket, successRate })
  }
  return Array.from(map.entries()).map(([process, trend]) => ({ process, trend }))
}

const option = computed(() => {
  const dark = isDark.value
  if (!props.data || props.data.length === 0) return {}

  // Transform flat data to per-process groups
  const grouped = groupByProcess(props.data)

  // Determine top N processes by average success rate (descending)
  const processAvg = grouped.map(d => {
    const rates = (d.trend || []).map(t => t.successRate ?? 0)
    const avg = rates.length > 0 ? rates.reduce((a, b) => a + b, 0) / rates.length : 0
    return { process: d.process, avg }
  })
  processAvg.sort((a, b) => b.avg - a.avg)
  const topProcesses = new Set(processAvg.slice(0, props.topCount).map(p => p.process))

  // Build shared time axis from all trends
  const allBuckets = new Set()
  grouped.forEach(d => {
    (d.trend || []).forEach(t => allBuckets.add(t.bucket))
  })
  const sortedBuckets = [...allBuckets].sort()

  // Format bucket labels
  const categories = sortedBuckets.map(bucket => {
    const date = new Date(bucket)
    const pad = (n) => String(n).padStart(2, '0')
    const today = new Date()
    if (date.toDateString() !== today.toDateString()) {
      return `${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
    }
    return `${pad(date.getHours())}:${pad(date.getMinutes())}`
  })

  // Build series - assign stable color indices based on sorted process order
  let topColorIdx = 0
  const series = grouped.map(d => {
    const isTop = topProcesses.has(d.process)
    const trendMap = new Map((d.trend || []).map(t => [t.bucket, t.successRate ?? 0]))
    const values = sortedBuckets.map(b => trendMap.get(b) ?? null)

    let color
    if (isTop) {
      color = TOP_COLORS[topColorIdx % TOP_COLORS.length]
      topColorIdx++
    } else {
      color = dark ? 'rgba(156,163,175,0.3)' : 'rgba(156,163,175,0.4)'
    }

    return {
      name: d.process,
      type: 'line',
      data: values,
      smooth: true,
      symbol: isTop ? 'circle' : 'none',
      symbolSize: 4,
      lineStyle: {
        width: isTop ? 2.5 : 1,
        type: isTop ? 'solid' : 'dashed',
        color
      },
      itemStyle: {
        color: isTop ? color : (dark ? '#6b7280' : '#9ca3af')
      },
      emphasis: {
        lineStyle: { width: 3 },
        focus: 'series'
      },
      z: isTop ? 10 : 1,
      connectNulls: true
    }
  })

  // Sort so top processes render on top
  series.sort((a, b) => {
    const aTop = topProcesses.has(a.name) ? 1 : 0
    const bTop = topProcesses.has(b.name) ? 1 : 0
    return aTop - bTop
  })

  const needsZoom = categories.length > 24

  return {
    tooltip: {
      trigger: 'axis',
      backgroundColor: dark ? '#1f2937' : '#fff',
      borderColor: dark ? '#374151' : '#e5e7eb',
      textStyle: { color: dark ? '#e5e7eb' : '#111827', fontSize: 12 },
      formatter: (params) => {
        const title = params[0]?.axisValueLabel || ''
        const sorted = [...params].filter(p => p.value != null).sort((a, b) => b.value - a.value)
        const lines = sorted.slice(0, 10).map(p =>
          `${p.marker} ${p.seriesName}: <b>${p.value.toFixed(1)}%</b>`
        ).join('<br/>')
        const extra = sorted.length > 10 ? `<br/><span style="color:#999">... +${sorted.length - 10} more</span>` : ''
        return `<b>${title}</b><br/>${lines}${extra}`
      }
    },
    legend: {
      top: 0,
      type: 'scroll',
      textStyle: { color: dark ? '#9ca3af' : '#6b7280', fontSize: 11 }
    },
    grid: {
      left: 10,
      right: 20,
      top: 40,
      bottom: needsZoom ? 50 : 10,
      containLabel: true
    },
    ...(needsZoom ? {
      dataZoom: [{
        type: 'slider',
        xAxisIndex: 0,
        bottom: 5,
        height: 16,
        startValue: Math.max(0, categories.length - 24),
        endValue: categories.length - 1,
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
      boundaryGap: false,
      axisLabel: {
        color: dark ? '#d1d5db' : '#374151',
        fontSize: 11,
        rotate: categories.length > 12 ? 35 : 0
      },
      axisLine: { lineStyle: { color: dark ? '#374151' : '#e5e7eb' } },
      axisTick: { show: false }
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 100,
      splitLine: { lineStyle: { color: dark ? '#374151' : '#e5e7eb' } },
      axisLabel: {
        color: dark ? '#9ca3af' : '#6b7280',
        formatter: '{value}%'
      }
    },
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
    <div v-else class="flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm" style="height: 200px">
      데이터가 없습니다
    </div>
  </div>
</template>
