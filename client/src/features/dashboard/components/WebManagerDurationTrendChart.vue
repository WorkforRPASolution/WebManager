<script setup>
import { computed } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { LineChart } from 'echarts/charts'
import { TooltipComponent, GridComponent, LegendComponent, DataZoomComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { useTheme } from '../../../shared/composables/useTheme'

use([LineChart, TooltipComponent, GridComponent, LegendComponent, DataZoomComponent, CanvasRenderer])

const props = defineProps({
  data: { type: Array, default: () => [] },
  pageSummary: { type: Array, default: () => [] },
  granularity: { type: String, default: 'daily' }
})

const { isDark } = useTheme()

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316']
const DARK_COLORS = ['#60A5FA', '#34D399', '#FBBF24', '#F87171', '#A78BFA', '#F472B6', '#2DD4BF', '#FB923C']
const MAX_VISIBLE = 24
const TOP_N = 6

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

function formatDuration(ms) {
  if (!ms || ms <= 0) return '0s'
  const totalSec = Math.round(ms / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  if (min === 0) return `${sec}s`
  return `${min}m ${sec}s`
}

// Top N 페이지 (pageSummary 기준 방문 횟수 내림차순)
const topPages = computed(() => {
  const summary = props.pageSummary || []
  return [...summary]
    .sort((a, b) => b.visitCount - a.visitCount)
    .slice(0, TOP_N)
    .map(p => p.pageName)
})

const needsZoom = computed(() => (props.data || []).length > MAX_VISIBLE)

const option = computed(() => {
  const items = props.data || []
  if (items.length === 0) return {}

  const dark = isDark.value
  const colors = dark ? DARK_COLORS : COLORS
  const textColor = dark ? '#9CA3AF' : '#6B7280'
  const dates = items.map(d => formatDateLabel(d.date, props.granularity))
  const pages = topPages.value

  const series = pages.map((page, idx) => ({
    name: page,
    type: 'line',
    smooth: true,
    symbol: 'circle',
    symbolSize: 3,
    lineStyle: { color: colors[idx % colors.length], width: 1.5 },
    itemStyle: { color: colors[idx % colors.length] },
    data: items.map(d => Math.round((d[page] || 0) / 60000 * 10) / 10) // ms → min (소수점 1자리)
  }))

  return {
    tooltip: {
      trigger: 'axis',
      backgroundColor: dark ? '#1f2937' : '#fff',
      borderColor: dark ? '#374151' : '#e5e7eb',
      textStyle: { color: dark ? '#e5e7eb' : '#111827' },
      formatter: (params) => {
        let html = `<b>${params[0].name}</b><br/>`
        for (const p of params) {
          if (p.value > 0) {
            html += `${p.marker} ${p.seriesName}: <b>${formatDuration(p.value * 60000)}</b><br/>`
          }
        }
        return html
      }
    },
    legend: {
      top: 0,
      type: 'scroll',
      textStyle: { color: textColor, fontSize: 11 },
      pageTextStyle: { color: textColor },
      pageIconColor: dark ? '#9ca3af' : '#6b7280',
      pageIconInactiveColor: dark ? '#374151' : '#d1d5db'
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
      boundaryGap: false,
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
      name: '분',
      nameTextStyle: { color: textColor, fontSize: 10 },
      splitLine: { lineStyle: { color: dark ? '#374151' : '#e5e7eb' } },
      axisLabel: { color: textColor, fontSize: 10 }
    },
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
