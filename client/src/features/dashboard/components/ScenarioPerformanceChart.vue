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
  const items = props.data
  const names = items.map(d => d.process)
  const rates = items.map(d => d.performanceRate || 0)

  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: dark ? '#1f2937' : '#fff',
      borderColor: dark ? '#374151' : '#e5e7eb',
      textStyle: { color: dark ? '#e5e7eb' : '#111827' },
      formatter: (params) => {
        const p = params[0]
        const item = items[p.dataIndex]
        if (!item) return p.name
        return `<b>${item.process}</b>: ${item.performanceFilled || 0}/${item.total || 0} (${item.performanceRate?.toFixed(1) || 0}%)`
      }
    },
    grid: {
      left: 10,
      right: 10,
      top: 25,
      bottom: names.length > 8 ? 60 : 30,
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: names,
      axisLabel: {
        color: dark ? '#d1d5db' : '#374151',
        fontSize: 10,
        rotate: names.length > 8 ? 35 : 0,
        overflow: 'truncate',
        width: 50
      },
      axisLine: { lineStyle: { color: dark ? '#374151' : '#e5e7eb' } },
      axisTick: { show: false }
    },
    yAxis: {
      type: 'value',
      max: 100,
      splitLine: { lineStyle: { color: dark ? '#374151' : '#e5e7eb' } },
      axisLabel: {
        color: dark ? '#9ca3af' : '#6b7280',
        fontSize: 10,
        formatter: '{value}%'
      }
    },
    animationEasing: 'elasticOut',
    animationDuration: 800,
    animationDelay: (idx) => idx * 80,
    series: [{
      type: 'bar',
      data: rates,
      itemStyle: {
        color: dark ? '#34d399' : '#10b981',
        borderRadius: [3, 3, 0, 0]
      },
      label: {
        show: true,
        position: 'top',
        color: dark ? '#d1d5db' : '#374151',
        fontSize: 10,
        formatter: (p) => `${p.value.toFixed(0)}%`
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
