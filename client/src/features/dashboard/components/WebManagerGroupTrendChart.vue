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
  granularity: { type: String, default: 'daily' }
})

const { isDark } = useTheme()

const GROUPS = ['Dashboard', 'Clients', 'Master Data', 'System']
const GROUP_COLORS = {
  Dashboard: '#3B82F6',
  Clients: '#10B981',
  'Master Data': '#8B5CF6',
  System: '#F59E0B'
}

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

const option = computed(() => {
  const items = props.data || []
  if (items.length === 0) return {}

  const dark = isDark.value
  const textColor = dark ? '#9CA3AF' : '#6B7280'
  const dates = items.map(d => formatDateLabel(d.date, props.granularity))

  const series = GROUPS.map(group => ({
    name: group,
    type: 'line',
    stack: 'total',
    areaStyle: { opacity: 0.4 },
    smooth: true,
    symbol: 'none',
    lineStyle: { width: 1.5, color: GROUP_COLORS[group] },
    itemStyle: { color: GROUP_COLORS[group] },
    data: items.map(d => d[group] || 0)
  }))

  return {
    tooltip: {
      trigger: 'axis',
      backgroundColor: dark ? '#1f2937' : '#fff',
      borderColor: dark ? '#374151' : '#e5e7eb',
      textStyle: { color: dark ? '#e5e7eb' : '#111827' }
    },
    legend: {
      data: GROUPS,
      top: 0,
      textStyle: { color: textColor, fontSize: 11 }
    },
    grid: { left: 45, right: 15, top: 35, bottom: items.length > 30 ? 55 : 30 },
    xAxis: {
      type: 'category',
      data: dates,
      boundaryGap: false,
      axisLabel: { color: textColor, fontSize: 10, rotate: items.length > 14 ? 45 : 0 }
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: textColor, fontSize: 10 },
      splitLine: { lineStyle: { color: dark ? '#374151' : '#E5E7EB' } }
    },
    ...(items.length > 30 ? {
      dataZoom: [{ type: 'slider', bottom: 5, height: 16 }]
    } : {}),
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
      style="width: 100%; height: 320px"
    />
    <div v-else class="flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm" style="height: 320px">
      데이터가 없습니다
    </div>
  </div>
</template>
