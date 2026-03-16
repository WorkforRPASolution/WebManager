<script setup>
import { computed } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { PieChart } from 'echarts/charts'
import { TooltipComponent, LegendComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { useTheme } from '../../../shared/composables/useTheme'
import { buildVersionColorMap } from '../utils/versionColors'

use([PieChart, TooltipComponent, LegendComponent, CanvasRenderer])

const props = defineProps({
  data: { type: Array, default: () => [] },
  allVersions: { type: Array, default: () => [] }
})

const { isDark } = useTheme()

const totalAgent = computed(() => props.data.reduce((sum, r) => sum + r.agentCount, 0))

const aggregated = computed(() => {
  const map = {}
  for (const row of props.data) {
    for (const [ver, count] of Object.entries(row.versionCounts || {})) {
      map[ver] = (map[ver] || 0) + count
    }
  }
  return map
})

const option = computed(() => {
  const dark = isDark.value
  const colorMap = buildVersionColorMap(props.allVersions, dark)
  const chartData = props.allVersions
    .filter(v => (aggregated.value[v] || 0) > 0)
    .map(v => ({
      value: aggregated.value[v] || 0,
      name: v,
      itemStyle: { color: colorMap[v] }
    }))

  return {
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} ({d}%)',
      backgroundColor: dark ? '#1f2937' : '#fff',
      borderColor: dark ? '#374151' : '#e5e7eb',
      textStyle: { color: dark ? '#e5e7eb' : '#111827' }
    },
    legend: {
      type: 'scroll',
      bottom: 0,
      textStyle: { color: dark ? '#9ca3af' : '#6b7280', fontSize: 11 }
    },
    series: [{
      type: 'pie',
      radius: ['50%', '78%'],
      center: ['50%', '42%'],
      avoidLabelOverlap: false,
      itemStyle: {
        borderRadius: 4,
        borderColor: dark ? '#1f2937' : '#fff',
        borderWidth: 2
      },
      label: {
        show: true,
        position: 'center',
        formatter: `{total|${totalAgent.value}}\n{label|Total}`,
        rich: {
          total: {
            fontSize: 28,
            fontWeight: 'bold',
            color: dark ? '#fff' : '#111827',
            lineHeight: 36
          },
          label: {
            fontSize: 13,
            color: dark ? '#9ca3af' : '#6b7280',
            lineHeight: 20
          }
        }
      },
      emphasis: {
        label: { show: true },
        itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0,0,0,0.2)' }
      },
      labelLine: { show: false },
      animationType: 'scale',
      animationEasing: 'elasticOut',
      animationDelay: (idx) => idx * 100,
      data: chartData
    }]
  }
})
</script>

<template>
  <div class="w-full h-full flex items-center justify-center" style="min-height: 280px">
    <VChart :option="option" autoresize style="width: 100%; height: 280px" />
  </div>
</template>
