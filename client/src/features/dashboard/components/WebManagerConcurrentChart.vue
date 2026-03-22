<script setup>
import { computed } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { LineChart } from 'echarts/charts'
import { TooltipComponent, GridComponent, DataZoomComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { useTheme } from '../../../shared/composables/useTheme'

use([LineChart, TooltipComponent, GridComponent, DataZoomComponent, CanvasRenderer])

const props = defineProps({
  data: { type: Array, default: () => [] },
  granularity: { type: String, default: 'daily' },
  peak: { type: Number, default: 0 }
})

const { isDark } = useTheme()

const MAX_VISIBLE = 24

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

const option = computed(() => {
  const items = props.data || []
  if (items.length === 0) return {}

  const dark = isDark.value
  const textColor = dark ? '#9CA3AF' : '#6B7280'
  const dates = items.map(d => formatDateLabel(d.date, props.granularity))
  const values = items.map(d => d.concurrent)

  return {
    tooltip: {
      trigger: 'axis',
      backgroundColor: dark ? '#1f2937' : '#fff',
      borderColor: dark ? '#374151' : '#e5e7eb',
      textStyle: { color: dark ? '#e5e7eb' : '#111827' },
      formatter: (params) => {
        const p = params[0]
        return `<b>${p.name}</b><br/>동시접속: <b>${p.value}</b>명`
      }
    },
    grid: {
      left: 10,
      right: 20,
      top: 15,
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
        fillerColor: dark ? 'rgba(239,68,68,0.2)' : 'rgba(239,68,68,0.15)',
        handleStyle: { color: dark ? '#ef4444' : '#dc2626', borderColor: dark ? '#ef4444' : '#dc2626' },
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
      minInterval: 1,
      splitLine: { lineStyle: { color: dark ? '#374151' : '#e5e7eb' } },
      axisLabel: { color: dark ? '#9ca3af' : '#6b7280' }
    },
    series: [{
      type: 'line',
      data: values,
      smooth: true,
      symbol: 'circle',
      symbolSize: 4,
      areaStyle: {
        color: {
          type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: dark ? 'rgba(239,68,68,0.3)' : 'rgba(239,68,68,0.2)' },
            { offset: 1, color: 'rgba(239,68,68,0)' }
          ]
        }
      },
      lineStyle: { color: dark ? '#f87171' : '#ef4444', width: 2 },
      itemStyle: {
        color: dark ? '#f87171' : '#ef4444',
        borderColor: dark ? '#1f2937' : '#fff',
        borderWidth: 2
      },
      markLine: props.peak > 0 ? {
        silent: true,
        data: [{ yAxis: props.peak, label: { formatter: `Peak ${props.peak}`, color: textColor, fontSize: 10 }, lineStyle: { color: dark ? '#f8717180' : '#ef444480', type: 'dashed' } }]
      } : undefined
    }]
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
