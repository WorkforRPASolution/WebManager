<script setup>
import { computed } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { BarChart } from 'echarts/charts'
import { TooltipComponent, LegendComponent, GridComponent, DataZoomComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { useTheme } from '../../../shared/composables/useTheme'
import { getStatusColor } from '../utils/recoveryColors'
import { sumByGroup, calcSuccessRate } from '../utils/recoveryStatusGroups'

use([BarChart, TooltipComponent, LegendComponent, GridComponent, DataZoomComponent, CanvasRenderer])

const props = defineProps({
  data: { type: Array, default: () => [] }
})

const { isDark } = useTheme()

const MAX_VISIBLE = 25
const STATUSES = ['Success', 'Failed', 'Stopped', 'Skip']

const option = computed(() => {
  const dark = isDark.value
  const categories = props.data.map(d => d.categoryName || `Category ${d.scCategory}`)

  const statusColors = {}
  for (const s of STATUSES) {
    statusColors[s] = getStatusColor(s, dark)
  }

  const seriesData = {}
  for (const s of STATUSES) seriesData[s] = []

  for (const row of props.data) {
    const sc = row.statusCounts || {}
    const total = row.total || 0
    const pct = (v) => total > 0 ? Math.round(v / total * 1000) / 10 : 0

    seriesData.Success.push(pct(sumByGroup(sc, 'success')))
    seriesData.Failed.push(pct(sumByGroup(sc, 'failed')))
    seriesData.Stopped.push(pct(sc.Stopped || 0))
    seriesData.Skip.push(pct(sc.Skip || 0))
  }

  const needsZoom = categories.length > MAX_VISIBLE

  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params) => {
        const title = params[0]?.axisValueLabel || ''
        const items = params.filter(p => p.value > 0)
        if (items.length === 0) return `<b>${title}</b><br/><span style="color:#999">No data</span>`
        const lines = items.map(p => `${p.marker} ${p.seriesName}: <b>${p.value}%</b>`).join('<br/>')
        return `<b>${title}</b><br/>${lines}`
      }
    },
    legend: {
      top: 0,
      textStyle: { color: dark ? '#9ca3af' : '#6b7280', fontSize: 11 }
    },
    grid: { top: 35, left: 10, right: 10, bottom: needsZoom ? 40 : 5, containLabel: true },
    xAxis: {
      type: 'category',
      data: categories,
      axisLabel: {
        color: dark ? '#d1d5db' : '#374151',
        fontSize: 11,
        rotate: categories.length > 8 ? 35 : 0,
        overflow: 'truncate',
        width: 80
      },
      axisLine: { lineStyle: { color: dark ? '#374151' : '#e5e7eb' } }
    },
    yAxis: {
      type: 'value',
      max: 100,
      axisLabel: { formatter: '{value}%', color: dark ? '#9ca3af' : '#6b7280', fontSize: 11 },
      splitLine: { lineStyle: { color: dark ? '#1f2937' : '#f3f4f6' } }
    },
    series: STATUSES.map((status, idx) => ({
      name: status,
      type: 'bar',
      stack: 'rate',
      data: seriesData[status],
      itemStyle: {
        color: statusColors[status],
        borderRadius: idx === STATUSES.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]
      },
      emphasis: { itemStyle: { shadowBlur: 6, shadowColor: 'rgba(0,0,0,0.15)' } },
      barMaxWidth: 40
    })),
    ...(needsZoom ? {
      dataZoom: [{
        type: 'slider', xAxisIndex: 0, bottom: 5, height: 16,
        startValue: 0, endValue: MAX_VISIBLE - 1,
        minValueSpan: Math.min(MAX_VISIBLE - 1, categories.length - 1),
        brushSelect: false, handleSize: '60%', borderColor: 'transparent',
        fillerColor: dark ? 'rgba(99,102,241,0.3)' : 'rgba(59,130,246,0.2)',
        handleStyle: { color: dark ? '#6366f1' : '#3b82f6', borderColor: dark ? '#6366f1' : '#3b82f6' },
        textStyle: { color: 'transparent' }
      }]
    } : {})
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
