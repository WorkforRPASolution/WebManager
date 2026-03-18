<script setup>
import { computed } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { LineChart } from 'echarts/charts'
import { TooltipComponent, LegendComponent, GridComponent, DataZoomComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { useTheme } from '../../../shared/composables/useTheme'
import { getStatusColor } from '../utils/recoveryColors'
import { formatBucketLabel } from '../utils/recoveryBucketFormat'

use([LineChart, TooltipComponent, LegendComponent, GridComponent, DataZoomComponent, CanvasRenderer])

const props = defineProps({
  data: { type: Array, default: () => [] },
  selectedItem: { type: String, default: '' },
  granularity: { type: String, default: 'hourly' }
})

const { isDark } = useTheme()

const STATUSES = ['Success', 'Failed', 'Stopped', 'Skip']

const option = computed(() => {
  const dark = isDark.value
  const items = props.data

  // x축: granularity에 따라 라벨 포맷
  const categories = items.map(d => formatBucketLabel(d.bucket, props.granularity))

  // 성공률 라인 (메인)
  const successRateData = items.map(d => {
    const sc = d.statusCounts || {}
    const total = Object.values(sc).reduce((s, v) => s + v, 0)
    const success = sc.Success || 0
    return total > 0 ? Math.round((success / total) * 1000) / 10 : 0
  })

  // 상태별 건수 라인
  const statusSeries = STATUSES.map(status => ({
    name: status,
    type: 'line',
    yAxisIndex: 1,
    data: items.map(d => (d.statusCounts && d.statusCounts[status]) || 0),
    smooth: true,
    symbol: 'circle',
    symbolSize: 4,
    lineStyle: {
      width: 1.5,
      color: getStatusColor(status, dark),
      type: status === 'Success' ? 'solid' : 'dashed'
    },
    itemStyle: {
      color: getStatusColor(status, dark)
    },
    z: status === 'Success' ? 5 : 2
  }))

  const needsZoom = categories.length > 24

  return {
    title: props.selectedItem ? {
      text: props.selectedItem,
      left: 'center',
      top: 0,
      textStyle: {
        fontSize: 13,
        fontWeight: 600,
        color: dark ? '#e5e7eb' : '#374151'
      }
    } : undefined,
    tooltip: {
      trigger: 'axis',
      backgroundColor: dark ? '#1f2937' : '#fff',
      borderColor: dark ? '#374151' : '#e5e7eb',
      textStyle: { color: dark ? '#e5e7eb' : '#111827', fontSize: 12 },
      formatter: (params) => {
        const title = params[0]?.axisValueLabel || ''
        const rateLine = params.find(p => p.seriesName === '성공률')
        const statusLines = params.filter(p => p.seriesName !== '성공률' && p.value > 0)
          .map(p => `${p.marker} ${p.seriesName}: <b>${p.value}</b>`)
          .join('<br/>')
        const rateStr = rateLine ? `${rateLine.marker} 성공률: <b>${rateLine.value}%</b>` : ''
        return `<b>${title}</b><br/>${rateStr}${statusLines ? '<br/>' + statusLines : ''}`
      }
    },
    legend: {
      top: props.selectedItem ? 24 : 0,
      type: 'scroll',
      textStyle: { color: dark ? '#9ca3af' : '#6b7280', fontSize: 11 },
      itemWidth: 14,
      itemHeight: 10
    },
    grid: {
      left: 10,
      right: 30,
      top: props.selectedItem ? 56 : 32,
      bottom: needsZoom ? 50 : 10,
      containLabel: true
    },
    ...(needsZoom ? {
      dataZoom: [{
        type: 'slider',
        xAxisIndex: 0,
        bottom: 5,
        height: 16,
        startValue: Math.max(0, categories.length - 24),
        endValue: categories.length - 1,
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
      boundaryGap: false,
      axisLabel: {
        color: dark ? '#d1d5db' : '#374151',
        fontSize: 11,
        rotate: categories.length > 12 ? 35 : 0
      },
      axisLine: { lineStyle: { color: dark ? '#374151' : '#e5e7eb' } },
      axisTick: { show: false }
    },
    yAxis: [
      {
        type: 'value',
        name: '성공률',
        nameTextStyle: { color: dark ? '#9ca3af' : '#6b7280', fontSize: 11 },
        min: 0,
        max: 100,
        splitLine: { lineStyle: { color: dark ? '#374151' : '#e5e7eb' } },
        axisLabel: {
          color: dark ? '#9ca3af' : '#6b7280',
          formatter: '{value}%'
        }
      },
      {
        type: 'value',
        name: '건수',
        nameTextStyle: { color: dark ? '#9ca3af' : '#6b7280', fontSize: 11 },
        splitLine: { show: false },
        axisLabel: { color: dark ? '#9ca3af' : '#6b7280' }
      }
    ],
    animationDuration: 800,
    series: [
      {
        name: '성공률',
        type: 'line',
        yAxisIndex: 0,
        data: successRateData,
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: {
          width: 2.5,
          color: dark ? '#60a5fa' : '#3b82f6'
        },
        itemStyle: {
          color: dark ? '#60a5fa' : '#3b82f6',
          borderColor: dark ? '#1f2937' : '#fff',
          borderWidth: 2
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: (dark ? '#3b82f6' : '#3b82f6') + '30' },
              { offset: 1, color: (dark ? '#3b82f6' : '#3b82f6') + '05' }
            ]
          }
        },
        z: 10
      },
      ...statusSeries
    ]
  }
})
</script>

<template>
  <div class="w-full">
    <template v-if="selectedItem && data.length > 0">
      <VChart
        :option="option"
        autoresize
        style="width: 100%; height: 320px"
      />
    </template>
    <div v-else class="flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm" style="height: 320px">
      <div class="text-center">
        <svg class="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
        </svg>
        <p>차트에서 항목을 클릭하세요</p>
      </div>
    </div>
  </div>
</template>
