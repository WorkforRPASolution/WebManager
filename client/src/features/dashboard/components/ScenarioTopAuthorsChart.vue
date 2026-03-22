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

const option = computed(() => {
  const dark = isDark.value
  const items = props.data.slice(0, 10)
  const names = items.map(d => d.name || d.userId)
  const values = items.map(d => d.modificationCount)
  const needsRotate = names.length > 5

  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: dark ? '#1f2937' : '#fff',
      borderColor: dark ? '#374151' : '#e5e7eb',
      textStyle: { color: dark ? '#e5e7eb' : '#111827' },
      formatter: (params) => {
        const p = params[0]
        const author = items[p.dataIndex] || {}
        const nameLine = author.name ? `<b>${author.name}</b> <span style="opacity:0.6">(${author.userId})</span>` : `<b>${author.userId}</b>`
        return `${nameLine}<br/>` +
          `수정: <b>${p.value}건</b><br/>` +
          `시나리오: <b>${author.scenarioCount || 0}개</b>`
      }
    },
    grid: {
      left: 10,
      right: 10,
      top: 25,
      bottom: needsRotate ? 60 : 30,
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: names,
      axisLabel: {
        color: dark ? '#d1d5db' : '#374151',
        fontSize: 10,
        rotate: needsRotate ? 35 : 0,
        overflow: 'truncate',
        width: 60
      },
      axisLine: { lineStyle: { color: dark ? '#374151' : '#e5e7eb' } },
      axisTick: { show: false }
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: dark ? '#374151' : '#e5e7eb' } },
      axisLabel: { color: dark ? '#9ca3af' : '#6b7280', fontSize: 10 }
    },
    animationEasing: 'elasticOut',
    animationDuration: 800,
    animationDelay: (idx) => idx * 60,
    series: [{
      type: 'bar',
      data: values,
      itemStyle: {
        color: dark ? '#a78bfa' : '#8b5cf6',
        borderRadius: [3, 3, 0, 0]
      },
      label: {
        show: true,
        position: 'top',
        color: dark ? '#d1d5db' : '#374151',
        fontSize: 10,
        formatter: '{c}'
      },
      emphasis: {
        itemStyle: { shadowBlur: 6, shadowColor: 'rgba(0,0,0,0.15)' }
      },
      barMaxWidth: 32
    }]
  }
})
</script>

<template>
  <div class="w-full" style="height: 450px">
    <VChart
      v-if="data.length > 0"
      :option="option"
      autoresize
      style="width: 100%; height: 100%"
    />
    <div v-else class="flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm h-full">
      선택한 기간에 수정 이력이 없습니다
    </div>
  </div>
</template>
