<script setup>
import { computed } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { BarChart } from 'echarts/charts'
import { TooltipComponent, GridComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { useTheme } from '../../../shared/composables/useTheme'

use([BarChart, TooltipComponent, GridComponent, CanvasRenderer])

const props = defineProps({
  data: { type: Array, default: () => [] }
})

const { isDark } = useTheme()

function formatDuration(ms) {
  if (!ms || ms <= 0) return '0s'
  const totalSec = Math.round(ms / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  if (min === 0) return `${sec}s`
  if (sec === 0) return `${min}m`
  return `${min}m ${sec}s`
}

const option = computed(() => {
  const items = props.data || []
  if (items.length === 0) return {}

  const dark = isDark.value
  const textColor = dark ? '#9CA3AF' : '#6B7280'
  const names = items.map(u => u.userId)
  const counts = items.map(u => u.visitCount)

  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: dark ? '#1f2937' : '#fff',
      borderColor: dark ? '#374151' : '#e5e7eb',
      textStyle: { color: dark ? '#e5e7eb' : '#111827' },
      formatter: (params) => {
        const p = params[0]
        const u = items[p.dataIndex]
        const lastVisit = u.lastVisitTime
          ? new Date(u.lastVisitTime).toLocaleString('ko-KR')
          : '-'
        return `<b>${u.userId}</b><br/>` +
          `방문: ${u.visitCount}회<br/>` +
          `총 체류: ${formatDuration(u.totalDurationMs)}<br/>` +
          `마지막 접속: ${lastVisit}`
      }
    },
    grid: { left: 20, right: 20, top: 30, bottom: items.length > 5 ? 60 : 30, containLabel: true },
    xAxis: {
      type: 'category',
      data: names,
      axisLabel: {
        color: textColor,
        fontSize: 10,
        rotate: items.length > 5 ? 30 : 0,
        interval: 0
      },
      axisLine: { lineStyle: { color: dark ? '#374151' : '#E5E7EB' } }
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: textColor, fontSize: 10 },
      splitLine: { lineStyle: { color: dark ? '#374151' : '#E5E7EB' } }
    },
    animationEasing: 'elasticOut',
    animationDuration: 800,
    animationDelay: (idx) => idx * 50,
    series: [{
      type: 'bar',
      data: counts,
      barMaxWidth: 40,
      itemStyle: {
        color: dark ? '#60A5FA' : '#3B82F6',
        borderRadius: [4, 4, 0, 0]
      },
      label: {
        show: true,
        position: 'top',
        fontSize: 10,
        color: textColor
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
      style="width: 100%; height: 450px"
    />
    <div v-else class="flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm" style="height: 450px">
      데이터가 없습니다
    </div>
  </div>
</template>
