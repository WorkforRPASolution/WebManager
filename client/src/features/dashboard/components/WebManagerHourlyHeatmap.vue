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

const DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일']
const HOURS = Array.from({ length: 24 }, (_, i) => `${i}시`)

// MongoDB $dayOfWeek: 1=Sun, 2=Mon, ..., 7=Sat → Mon-Sun 인덱스로 변환
function toMonSunIndex(dow) {
  return dow === 1 ? 6 : dow - 2 // 1(Sun)→6, 2(Mon)→0, 3(Tue)→1, ..., 7(Sat)→5
}

const option = computed(() => {
  const items = props.data || []
  if (items.length === 0) return {}

  const dark = isDark.value
  const textColor = dark ? '#9CA3AF' : '#6B7280'

  // 모든 168셀(24h × 7d) 초기화 후 데이터 덮어쓰기 → 빈 셀도 0으로 표시
  const grid = {}
  for (let h = 0; h < 24; h++) {
    for (let d = 0; d < 7; d++) {
      grid[`${h}-${d}`] = [h, d, 0]
    }
  }
  for (const d of items) {
    const idx = toMonSunIndex(d.dayOfWeek)
    grid[`${d.hour}-${idx}`] = [d.hour, idx, d.count]
  }
  const heatData = Object.values(grid)
  const maxCount = Math.max(...items.map(d => d.count), 1)

  return {
    tooltip: {
      backgroundColor: dark ? '#1f2937' : '#fff',
      borderColor: dark ? '#374151' : '#e5e7eb',
      textStyle: { color: dark ? '#e5e7eb' : '#111827' },
      formatter: (p) => `${DAY_LABELS[p.value[1]] || ''} ${p.value[0]}시<br/>방문: <b>${p.value[2]}</b>회`
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
