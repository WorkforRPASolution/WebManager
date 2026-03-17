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
  data: { type: Array, default: () => [] },
  title: { type: String, default: '' },
  color: { type: String, default: '#ef4444' }
})

const { isDark } = useTheme()

const option = computed(() => {
  const dark = isDark.value
  // Top 10, reversed for display (top item at top)
  const items = props.data.slice(0, 10)
  const names = items.map(d => d.name).reverse()
  const values = items.map(d => d.count).reverse()

  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: dark ? '#1f2937' : '#fff',
      borderColor: dark ? '#374151' : '#e5e7eb',
      textStyle: { color: dark ? '#e5e7eb' : '#111827' },
      formatter: (params) => {
        const p = params[0]
        return `${p.name}: <b>${p.value}</b>`
      }
    },
    grid: {
      left: 10,
      right: 50,
      top: 5,
      bottom: 5,
      containLabel: true
    },
    xAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: dark ? '#374151' : '#e5e7eb' } },
      axisLabel: { color: dark ? '#9ca3af' : '#6b7280' }
    },
    yAxis: {
      type: 'category',
      data: names,
      axisLabel: {
        color: dark ? '#d1d5db' : '#374151',
        fontSize: 11,
        overflow: 'truncate',
        width: 120
      },
      axisLine: { lineStyle: { color: dark ? '#374151' : '#e5e7eb' } },
      axisTick: { show: false }
    },
    animationEasing: 'elasticOut',
    animationDuration: 800,
    series: [{
      type: 'bar',
      data: values,
      itemStyle: {
        color: props.color,
        borderRadius: [0, 4, 4, 0]
      },
      label: {
        show: true,
        position: 'right',
        color: dark ? '#d1d5db' : '#374151',
        fontSize: 11,
        formatter: '{c}'
      },
      emphasis: {
        itemStyle: { shadowBlur: 6, shadowColor: 'rgba(0,0,0,0.15)' }
      },
      barMaxWidth: 24
    }]
  }
})

const chartHeight = computed(() => {
  const count = Math.min(props.data.length, 10)
  return Math.max(200, count * 32 + 20)
})
</script>

<template>
  <div class="w-full">
    <VChart
      v-if="data.length > 0"
      :option="option"
      autoresize
      :style="{ width: '100%', height: chartHeight + 'px' }"
    />
    <div v-else class="flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm" style="height: 200px">
      데이터가 없습니다
    </div>
  </div>
</template>
