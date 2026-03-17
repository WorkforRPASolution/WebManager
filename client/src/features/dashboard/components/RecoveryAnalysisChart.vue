<script setup>
import { computed } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { BarChart } from 'echarts/charts'
import { TooltipComponent, LegendComponent, GridComponent, DataZoomComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { useTheme } from '../../../shared/composables/useTheme'
import { getStatusColor, getStatusList } from '../utils/recoveryColors'

use([BarChart, TooltipComponent, LegendComponent, GridComponent, DataZoomComponent, CanvasRenderer])

const props = defineProps({
  data: { type: Array, default: () => [] },
  maxItems: { type: Number, default: 20 }
})

const emit = defineEmits(['select'])

const { isDark } = useTheme()

const statusList = getStatusList()

const displayData = computed(() => {
  return props.data.slice(0, Math.max(props.data.length, props.maxItems))
})

const needsZoom = computed(() => displayData.value.length > props.maxItems)

const option = computed(() => {
  const dark = isDark.value
  const items = displayData.value
  const categories = items.map(d => d.name)

  const series = statusList.map(status => ({
    name: status,
    type: 'bar',
    stack: 'total',
    data: items.map(d => (d.statusCounts && d.statusCounts[status]) || 0),
    itemStyle: {
      color: getStatusColor(status, dark),
      borderRadius: 0
    },
    emphasis: {
      itemStyle: { shadowBlur: 6, shadowColor: 'rgba(0,0,0,0.15)' }
    },
    barMaxWidth: 28
  }))

  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: dark ? '#1f2937' : '#fff',
      borderColor: dark ? '#374151' : '#e5e7eb',
      textStyle: { color: dark ? '#e5e7eb' : '#111827' },
      formatter: (params) => {
        const title = params[0]?.axisValueLabel || ''
        const filteredParams = params.filter(p => p.value > 0)
        if (filteredParams.length === 0) return `${title}<br/>데이터 없음`
        const lines = filteredParams.map(p => `${p.marker} ${p.seriesName}: <b>${p.value}</b>`).join('<br/>')
        const total = filteredParams.reduce((s, p) => s + p.value, 0)
        return `<b>${title}</b> (Total: ${total})<br/>${lines}`
      }
    },
    legend: {
      top: 0,
      textStyle: { color: dark ? '#9ca3af' : '#6b7280' }
    },
    grid: {
      left: 10,
      right: 30,
      top: 32,
      bottom: needsZoom.value ? 50 : 10,
      containLabel: true
    },
    ...(needsZoom.value ? {
      dataZoom: [{
        type: 'slider',
        yAxisIndex: 0,
        right: 5,
        width: 16,
        startValue: 0,
        endValue: props.maxItems - 1,
        minValueSpan: Math.min(props.maxItems - 1, categories.length - 1),
        brushSelect: false,
        handleSize: '60%',
        borderColor: 'transparent',
        fillerColor: dark ? 'rgba(99,102,241,0.3)' : 'rgba(59,130,246,0.2)',
        handleStyle: { color: dark ? '#6366f1' : '#3b82f6', borderColor: dark ? '#6366f1' : '#3b82f6' },
        textStyle: { color: 'transparent' }
      }]
    } : {}),
    yAxis: {
      type: 'category',
      data: categories,
      inverse: true,
      triggerEvent: true,
      axisLabel: {
        color: dark ? '#d1d5db' : '#374151',
        fontSize: 11,
        overflow: 'truncate',
        width: 120
      },
      axisLine: { lineStyle: { color: dark ? '#374151' : '#e5e7eb' } },
      axisTick: { show: false }
    },
    xAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: dark ? '#374151' : '#e5e7eb' } },
      axisLabel: { color: dark ? '#9ca3af' : '#6b7280' }
    },
    animationEasing: 'elasticOut',
    animationDuration: 800,
    animationDelay: (idx) => idx * 50,
    series
  }
})

function handleChartClick(params) {
  if (params.componentType === 'series') {
    const name = displayData.value[params.dataIndex]?.name
    if (name) {
      emit('select', name)
    }
  }
}
</script>

<template>
  <div class="w-full">
    <VChart
      v-if="data.length > 0"
      :option="option"
      autoresize
      style="width: 100%; height: 400px"
      @click="handleChartClick"
    />
    <div v-else class="flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm" style="height: 200px">
      데이터가 없습니다
    </div>
  </div>
</template>
