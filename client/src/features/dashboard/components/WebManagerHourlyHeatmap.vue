<script setup>
import { computed } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { HeatmapChart } from 'echarts/charts'
import { TooltipComponent, GridComponent, VisualMapComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { useTheme } from '../../../shared/composables/useTheme'

use([HeatmapChart, TooltipComponent, GridComponent, VisualMapComponent, CanvasRenderer])

const props = defineProps({
  data: { type: Array, default: () => [] }
})

const { isDark } = useTheme()

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']
const HOURS = Array.from({ length: 24 }, (_, i) => `${i}시`)

const option = computed(() => {
  const items = props.data || []
  if (items.length === 0) return {}

  const dark = isDark.value
  const textColor = dark ? '#9CA3AF' : '#6B7280'

  // dayOfWeek: 1=Sun → index 0, 2=Mon → index 1, ...
  const heatData = items.map(d => [d.hour, d.dayOfWeek - 1, d.count])
  const maxCount = Math.max(...items.map(d => d.count), 1)

  return {
    tooltip: {
      backgroundColor: dark ? '#1f2937' : '#fff',
      borderColor: dark ? '#374151' : '#e5e7eb',
      textStyle: { color: dark ? '#e5e7eb' : '#111827' },
      formatter: (p) => `${DAY_LABELS[p.value[1]]} ${p.value[0]}시<br/>방문: <b>${p.value[2]}</b>회`
    },
    grid: { left: 40, right: 20, top: 10, bottom: 60 },
    xAxis: {
      type: 'category',
      data: HOURS,
      splitArea: { show: true },
      axisLabel: { color: textColor, fontSize: 10, interval: 1 }
    },
    yAxis: {
      type: 'category',
      data: DAY_LABELS,
      splitArea: { show: true },
      axisLabel: { color: textColor, fontSize: 11 }
    },
    visualMap: {
      min: 0,
      max: maxCount,
      calculable: true,
      orient: 'horizontal',
      left: 'center',
      bottom: 5,
      itemWidth: 12,
      itemHeight: 100,
      textStyle: { color: textColor, fontSize: 10 },
      inRange: {
        color: dark
          ? ['#1e293b', '#1e40af', '#3b82f6', '#60a5fa', '#93c5fd']
          : ['#eff6ff', '#bfdbfe', '#60a5fa', '#3b82f6', '#1d4ed8']
      }
    },
    series: [{
      type: 'heatmap',
      data: heatData,
      label: { show: false },
      emphasis: {
        itemStyle: { shadowBlur: 5, shadowColor: 'rgba(0,0,0,0.3)' }
      }
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
      style="width: 100%; height: 320px"
    />
    <div v-else class="flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm" style="height: 320px">
      데이터가 없습니다
    </div>
  </div>
</template>
