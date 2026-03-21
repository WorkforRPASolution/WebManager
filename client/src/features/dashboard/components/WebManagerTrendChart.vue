<script setup>
import { computed } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { BarChart, LineChart } from 'echarts/charts'
import { TooltipComponent, GridComponent, LegendComponent, DataZoomComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { useTheme } from '../../../shared/composables/useTheme'

use([BarChart, LineChart, TooltipComponent, GridComponent, LegendComponent, DataZoomComponent, CanvasRenderer])

const props = defineProps({
  data: { type: Array, default: () => [] },
  period: { type: String, default: '30d' }
})

const { isDark } = useTheme()

const processedData = computed(() => {
  const raw = props.data || []
  if (raw.length === 0) return []
  // 90d or long custom: weekly rollup
  if ((props.period === '90d' || (props.period === 'custom' && raw.length > 35)) && raw.length > 35) {
    const weeks = []
    for (let i = 0; i < raw.length; i += 7) {
      const chunk = raw.slice(i, i + 7)
      const totalVisits = chunk.reduce((s, d) => s + d.visits, 0)
      const maxUsers = Math.max(...chunk.map(d => d.uniqueUsers))
      weeks.push({ date: chunk[0].date, visits: totalVisits, uniqueUsers: maxUsers })
    }
    return weeks
  }
  return raw
})

const option = computed(() => {
  const items = processedData.value
  if (items.length === 0) return {}

  const dark = isDark.value
  const textColor = dark ? '#9CA3AF' : '#6B7280'
  const dates = items.map(i => i.date)
  const visits = items.map(i => i.visits)
  const users = items.map(i => i.uniqueUsers)

  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
      backgroundColor: dark ? '#1f2937' : '#fff',
      borderColor: dark ? '#374151' : '#e5e7eb',
      textStyle: { color: dark ? '#e5e7eb' : '#111827' }
    },
    legend: {
      data: ['총 방문', '고유 사용자'],
      top: 0,
      textStyle: { color: textColor, fontSize: 11 }
    },
    grid: { left: 50, right: 50, top: 35, bottom: items.length > 30 ? 55 : 30 },
    xAxis: {
      type: 'category',
      data: dates,
      axisLabel: { color: textColor, fontSize: 10, rotate: items.length > 14 ? 45 : 0 }
    },
    yAxis: [
      {
        type: 'value',
        name: '방문',
        nameTextStyle: { color: textColor, fontSize: 10 },
        axisLabel: { color: textColor, fontSize: 10 },
        splitLine: { lineStyle: { color: dark ? '#374151' : '#E5E7EB' } }
      },
      {
        type: 'value',
        name: '사용자',
        nameTextStyle: { color: textColor, fontSize: 10 },
        axisLabel: { color: textColor, fontSize: 10 },
        splitLine: { show: false }
      }
    ],
    ...(items.length > 30 ? {
      dataZoom: [{ type: 'slider', bottom: 5, height: 16 }]
    } : {}),
    series: [
      {
        name: '총 방문',
        type: 'bar',
        yAxisIndex: 0,
        data: visits,
        itemStyle: { color: dark ? '#4B5563' : '#D1D5DB' },
        barMaxWidth: 20
      },
      {
        name: '고유 사용자',
        type: 'line',
        yAxisIndex: 1,
        data: users,
        smooth: true,
        symbol: 'circle',
        symbolSize: 4,
        lineStyle: { color: '#3B82F6', width: 2 },
        itemStyle: { color: '#3B82F6' }
      }
    ]
  }
})
</script>

<template>
  <div class="w-full">
    <VChart
      v-if="(data || []).length > 0"
      :option="option"
      autoresize
      style="width: 100%; height: 300px"
    />
    <div v-else class="flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm" style="height: 300px">
      데이터가 없습니다
    </div>
  </div>
</template>
