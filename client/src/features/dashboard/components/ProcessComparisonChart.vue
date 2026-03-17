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
  data: { type: Array, default: () => [] },
  // 'grouped' = success/fail/stopped rate bars, 'stacked' = count stacked bars
  mode: { type: String, default: 'grouped' }
})

const { isDark } = useTheme()

const MAX_VISIBLE = 15

const needsZoom = computed(() => props.data.length > MAX_VISIBLE)

const option = computed(() => {
  const dark = isDark.value
  const categories = props.data.map(d => d.process)

  if (props.mode === 'stacked') {
    return buildStackedOption(dark, categories)
  }
  return buildGroupedOption(dark, categories)
})

function buildGroupedOption(dark, categories) {
  const successRates = props.data.map(d => {
    const rate = calcSuccessRate(d.statusCounts, d.total)
    return Math.round(rate * 10) / 10
  })
  const failedRates = props.data.map(d => {
    const count = sumByGroup(d.statusCounts, 'failed')
    return d.total ? Math.round((count / d.total * 100) * 10) / 10 : 0
  })
  const stoppedRates = props.data.map(d => {
    const count = sumByGroup(d.statusCounts, 'stopped')
    return d.total ? Math.round((count / d.total * 100) * 10) / 10 : 0
  })

  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: dark ? '#1f2937' : '#fff',
      borderColor: dark ? '#374151' : '#e5e7eb',
      textStyle: { color: dark ? '#e5e7eb' : '#111827' },
      formatter: (params) => {
        const title = params[0]?.axisValueLabel || ''
        const lines = params
          .filter(p => p.value > 0)
          .map(p => `${p.marker} ${p.seriesName}: <b>${p.value}%</b>`)
          .join('<br/>')
        return `<b>${title}</b><br/>${lines || '데이터 없음'}`
      }
    },
    legend: {
      top: 0,
      textStyle: { color: dark ? '#9ca3af' : '#6b7280' }
    },
    grid: {
      left: 10,
      right: 20,
      top: 32,
      bottom: needsZoom.value ? 50 : 10,
      containLabel: true
    },
    ...(needsZoom.value ? {
      dataZoom: [{
        type: 'slider',
        xAxisIndex: 0,
        bottom: 5,
        height: 16,
        startValue: 0,
        endValue: MAX_VISIBLE - 1,
        minValueSpan: Math.min(MAX_VISIBLE - 1, categories.length - 1),
        brushSelect: false,
        handleSize: '60%',
        borderColor: 'transparent',
        fillerColor: dark ? 'rgba(99,102,241,0.3)' : 'rgba(59,130,246,0.2)',
        handleStyle: { color: dark ? '#6366f1' : '#3b82f6', borderColor: dark ? '#6366f1' : '#3b82f6' },
        textStyle: { color: 'transparent' }
      }]
    } : {}),
    xAxis: {
      type: 'category',
      data: categories,
      axisLabel: {
        color: dark ? '#d1d5db' : '#374151',
        fontSize: 11,
        rotate: categories.length > 8 ? 35 : 0,
        overflow: 'truncate',
        width: 70
      },
      axisLine: { lineStyle: { color: dark ? '#374151' : '#e5e7eb' } },
      axisTick: { show: false },
      axisPointer: {
        type: 'shadow',
        label: {
          show: true,
          backgroundColor: dark ? '#374151' : '#111827',
          color: '#fff',
          fontSize: 12,
          padding: [4, 8]
        }
      }
    },
    yAxis: {
      type: 'value',
      max: 100,
      splitLine: { lineStyle: { color: dark ? '#374151' : '#e5e7eb' } },
      axisLabel: {
        color: dark ? '#9ca3af' : '#6b7280',
        formatter: '{value}%'
      }
    },
    animationEasing: 'elasticOut',
    animationDuration: 1000,
    animationDelay: (idx) => idx * 80,
    series: [
      {
        name: 'Success Rate',
        type: 'bar',
        data: successRates,
        itemStyle: {
          color: getStatusColor('Success', dark),
          borderRadius: [4, 4, 0, 0]
        },
        emphasis: { itemStyle: { shadowBlur: 6, shadowColor: 'rgba(0,0,0,0.15)' } },
        barMaxWidth: 40
      },
      {
        name: 'Failed Rate',
        type: 'bar',
        data: failedRates,
        itemStyle: {
          color: getStatusColor('Failed', dark),
          borderRadius: [4, 4, 0, 0]
        },
        emphasis: { itemStyle: { shadowBlur: 6, shadowColor: 'rgba(0,0,0,0.15)' } },
        barMaxWidth: 40
      },
      {
        name: 'Stopped Rate',
        type: 'bar',
        data: stoppedRates,
        itemStyle: {
          color: getStatusColor('Stopped', dark),
          borderRadius: [4, 4, 0, 0]
        },
        emphasis: { itemStyle: { shadowBlur: 6, shadowColor: 'rgba(0,0,0,0.15)' } },
        barMaxWidth: 40
      }
    ]
  }
}

function buildStackedOption(dark, categories) {
  const MAIN_STATUSES = ['Success', 'Failed', 'Stopped', 'Skip']

  const seriesData = {}
  MAIN_STATUSES.forEach(s => { seriesData[s] = [] })
  seriesData['Other'] = []

  props.data.forEach(d => {
    const sc = d.statusCounts || {}
    MAIN_STATUSES.forEach(s => {
      if (s === 'Failed') {
        seriesData[s].push(
          (sc.Failed || 0) + (sc.ScriptFailed || 0) + (sc.VisionDelayed || 0) + (sc.NotStarted || 0)
        )
      } else {
        seriesData[s].push(sc[s] || 0)
      }
    })
    const mainSum = (sc.Success || 0) + (sc.Failed || 0) + (sc.ScriptFailed || 0) +
      (sc.VisionDelayed || 0) + (sc.NotStarted || 0) + (sc.Stopped || 0) + (sc.Skip || 0)
    const total = Object.values(sc).reduce((sum, v) => sum + v, 0)
    seriesData['Other'].push(Math.max(0, total - mainSum))
  })

  const statusColors = {
    Success: getStatusColor('Success', dark),
    Failed: getStatusColor('Failed', dark),
    Stopped: getStatusColor('Stopped', dark),
    Skip: getStatusColor('Skip', dark),
    Other: dark ? '#4b5563' : '#d1d5db'
  }

  const allStatuses = [...MAIN_STATUSES, 'Other']

  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: dark ? '#1f2937' : '#fff',
      borderColor: dark ? '#374151' : '#e5e7eb',
      textStyle: { color: dark ? '#e5e7eb' : '#111827' },
      formatter: (params) => {
        const title = params[0]?.axisValueLabel || ''
        const items = params.filter(p => p.value > 0)
        if (items.length === 0) return `${title}<br/>데이터 없음`
        const total = params.reduce((s, p) => s + (p.value || 0), 0)
        const lines = items.map(p => `${p.marker} ${p.seriesName}: <b>${p.value.toLocaleString()}</b>`).join('<br/>')
        return `<b>${title}</b> (Total: ${total.toLocaleString()})<br/>${lines}`
      }
    },
    legend: {
      top: 0,
      textStyle: { color: dark ? '#9ca3af' : '#6b7280' }
    },
    grid: {
      left: 10,
      right: 20,
      top: 32,
      bottom: needsZoom.value ? 50 : 10,
      containLabel: true
    },
    ...(needsZoom.value ? {
      dataZoom: [{
        type: 'slider',
        xAxisIndex: 0,
        bottom: 5,
        height: 16,
        startValue: 0,
        endValue: MAX_VISIBLE - 1,
        minValueSpan: Math.min(MAX_VISIBLE - 1, categories.length - 1),
        brushSelect: false,
        handleSize: '60%',
        borderColor: 'transparent',
        fillerColor: dark ? 'rgba(99,102,241,0.3)' : 'rgba(59,130,246,0.2)',
        handleStyle: { color: dark ? '#6366f1' : '#3b82f6', borderColor: dark ? '#6366f1' : '#3b82f6' },
        textStyle: { color: 'transparent' }
      }]
    } : {}),
    xAxis: {
      type: 'category',
      data: categories,
      axisLabel: {
        color: dark ? '#d1d5db' : '#374151',
        fontSize: 11,
        rotate: categories.length > 8 ? 35 : 0,
        overflow: 'truncate',
        width: 70
      },
      axisLine: { lineStyle: { color: dark ? '#374151' : '#e5e7eb' } },
      axisTick: { show: false },
      axisPointer: {
        type: 'shadow',
        label: {
          show: true,
          backgroundColor: dark ? '#374151' : '#111827',
          color: '#fff',
          fontSize: 12,
          padding: [4, 8]
        }
      }
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: dark ? '#374151' : '#e5e7eb' } },
      axisLabel: { color: dark ? '#9ca3af' : '#6b7280' }
    },
    animationEasing: 'elasticOut',
    animationDuration: 800,
    series: allStatuses.map((status, idx) => ({
      name: status,
      type: 'bar',
      stack: 'total',
      data: seriesData[status],
      itemStyle: {
        color: statusColors[status],
        borderRadius: idx === allStatuses.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]
      },
      emphasis: { itemStyle: { shadowBlur: 6, shadowColor: 'rgba(0,0,0,0.15)' } },
      barMaxWidth: 50
    }))
  }
}
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
