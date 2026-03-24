<script setup>
import { computed } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { PieChart } from 'echarts/charts'
import { TooltipComponent, LegendComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { useTheme } from '@/shared/composables/useTheme'

use([PieChart, TooltipComponent, LegendComponent, CanvasRenderer])

const props = defineProps({
  data: { type: Object, default: () => ({}) }
})

const { isDark } = useTheme()

const COLORS = {
  audit: '#3b82f6',
  error: '#ef4444',
  auth: '#22c55e',
  batch: '#a855f7',
  access: '#f59e0b',
  'eqp-redis': '#f97316'
}

const LABELS = {
  audit: 'Audit',
  error: 'Error',
  auth: 'Auth',
  batch: 'Batch',
  access: 'Access',
  'eqp-redis': 'EQP Redis'
}

const hasData = computed(() => {
  const d = props.data
  return (d.audit || 0) + (d.error || 0) + (d.auth || 0) + (d.batch || 0) + (d.access || 0) + (d['eqp-redis'] || 0) > 0
})

const option = computed(() => {
  const dark = isDark.value
  const d = props.data

  const seriesData = ['audit', 'error', 'auth', 'batch', 'access', 'eqp-redis']
    .map(cat => ({
      name: LABELS[cat],
      value: d[cat] || 0,
      itemStyle: { color: COLORS[cat] }
    }))
    .filter(item => item.value > 0)

  return {
    tooltip: {
      trigger: 'item',
      backgroundColor: dark ? '#1f2937' : '#fff',
      borderColor: dark ? '#374151' : '#e5e7eb',
      textStyle: { color: dark ? '#e5e7eb' : '#111827' },
      formatter: (p) => `${p.marker} ${p.name}: <b>${p.value.toLocaleString()}</b> (${p.percent}%)`
    },
    legend: {
      orient: 'vertical',
      right: 10,
      top: 'center',
      textStyle: { color: dark ? '#9ca3af' : '#6b7280', fontSize: 12 }
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
