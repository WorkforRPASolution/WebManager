<script setup>
import { computed } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { PieChart } from 'echarts/charts'
import { TooltipComponent, LegendComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { useChartTheme } from '@/shared/composables/useChartTheme'
import { CATEGORY_COLORS, CATEGORY_LABELS } from '../constants'

use([PieChart, TooltipComponent, LegendComponent, CanvasRenderer])

const props = defineProps({
  data: { type: Object, default: () => ({}) }
})

const { isDark, tooltipStyle, legendStyle } = useChartTheme()

const hasData = computed(() => {
  const d = props.data
  return (d.audit || 0) + (d.error || 0) + (d.auth || 0) + (d.batch || 0) + (d.access || 0) + (d['eqp-redis'] || 0) > 0
})

const option = computed(() => {
  const dark = isDark.value
  const d = props.data

  const seriesData = ['audit', 'error', 'auth', 'batch', 'access', 'eqp-redis']
    .map(cat => ({
      name: CATEGORY_LABELS[cat],
      value: d[cat] || 0,
      itemStyle: { color: CATEGORY_COLORS[cat] }
    }))
    .filter(item => item.value > 0)

  return {
    tooltip: {
      trigger: 'item',
      ...tooltipStyle(dark),
      formatter: (p) => `${p.marker} ${p.name}: <b>${p.value.toLocaleString()}</b> (${p.percent}%)`
    },
    legend: {
      orient: 'vertical',
      right: 10,
      top: 'center',
      textStyle: { ...legendStyle(dark), fontSize: 12 }
    },
    series: [{
      type: 'pie',
      radius: ['45%', '70%'],
      center: ['35%', '50%'],
      avoidLabelOverlap: true,
      label: { show: false },
      emphasis: {
        label: { show: true, fontWeight: 'bold', fontSize: 13 },
        itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.15)' }
      },
      data: seriesData
    }],
    animationDuration: 600
  }
})
</script>

<template>
  <div class="w-full">
    <VChart
      v-if="hasData"
      :option="option"
      autoresize
      style="width: 100%; height: 320px"
    />
    <div
      v-else
      class="flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm"
      style="height: 320px"
    >
      No data
    </div>
  </div>
</template>
