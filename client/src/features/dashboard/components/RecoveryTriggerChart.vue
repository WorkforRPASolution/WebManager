<script setup>
import { computed } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { BarChart } from 'echarts/charts'
import { TooltipComponent, GridComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { useTheme } from '../../../shared/composables/useTheme'
import { getTriggerColor } from '../utils/recoveryColors'

use([BarChart, TooltipComponent, GridComponent, CanvasRenderer])

const props = defineProps({
  data: { type: Array, default: () => [] }
})

const { isDark } = useTheme()

const option = computed(() => {
  const dark = isDark.value
  const grandTotal = props.data.reduce((sum, d) => sum + (d.total || 0), 0)

  // reversed for display (first item at top)
  const items = [...props.data].reverse()
  const names = items.map(d => d.trigger_by || 'Unknown')
  const values = items.map(d => d.total || 0)
  const colors = items.map(d => getTriggerColor(d.trigger_by || 'Unknown', dark))

  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: dark ? '#1f2937' : '#fff',
      borderColor: dark ? '#374151' : '#e5e7eb',
      textStyle: { color: dark ? '#e5e7eb' : '#111827' },
      formatter: (params) => {
        const p = params[0]
        const pct = grandTotal > 0 ? ((p.value / grandTotal) * 100).toFixed(1) : '0'
        return `${p.name}: <b>${p.value}</b> (${pct}%)`
      }
    },
    grid: {
      left: 10,
      right: 80,
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
        fontSize: 12
      },
      axisLine: { lineStyle: { color: dark ? '#374151' : '#e5e7eb' } },
      axisTick: { show: false }
    },
    animationEasing: 'elasticOut',
    animationDuration: 800,
    series: [{
      type: 'bar',
      data: values.map((v, i) => ({
        value: v,
        itemStyle: { color: colors[i], borderRadius: [0, 4, 4, 0] }
      })),
      label: {
        show: true,
        position: 'right',
        color: dark ? '#d1d5db' : '#374151',
        fontSize: 11,
        formatter: (params) => {
          const pct = grandTotal > 0 ? ((params.value / grandTotal) * 100).toFixed(0) : '0'
          return `${params.value} (${pct}%)`
        }
      },
      emphasis: {
        itemStyle: { shadowBlur: 6, shadowColor: 'rgba(0,0,0,0.15)' }
      },
      barMaxWidth: 30
    }]
  }
})

const chartHeight = computed(() => {
  const count = props.data.length
  return Math.max(150, count * 40 + 20)
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
    <div v-else class="flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm" style="height: 150px">
      데이터가 없습니다
    </div>
  </div>
</template>
