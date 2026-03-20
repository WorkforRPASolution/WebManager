<script setup>
import { computed } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { PieChart } from 'echarts/charts'
import { TooltipComponent, LegendComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { useTheme } from '../../../shared/composables/useTheme'

use([PieChart, TooltipComponent, LegendComponent, CanvasRenderer])

const props = defineProps({
  processSummary: { type: Array, default: () => [] }
})

const { isDark } = useTheme()

const COLORS_LIGHT = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1']
const COLORS_DARK = ['#60a5fa', '#34d399', '#fbbf24', '#f87171', '#a78bfa', '#f472b6', '#22d3ee', '#a3e635', '#fb923c', '#818cf8']

const totalActive = computed(() =>
  props.processSummary.reduce((sum, p) => sum + (p.activeUsers || 0), 0)
)

const option = computed(() => {
  const dark = isDark.value
  const colors = dark ? COLORS_DARK : COLORS_LIGHT
  const total = totalActive.value

  const data = props.processSummary
    .filter(p => p.activeUsers > 0)
    .map((p, idx) => ({
      value: p.activeUsers,
      name: p.process,
      itemStyle: { color: colors[idx % colors.length] }
    }))

  return {
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c}명 ({d}%)',
      backgroundColor: dark ? '#1f2937' : '#fff',
      borderColor: dark ? '#374151' : '#e5e7eb',
      textStyle: { color: dark ? '#e5e7eb' : '#111827' }
    },
    legend: {
      bottom: 0,
      textStyle: { color: dark ? '#9ca3af' : '#6b7280', fontSize: 11 }
    },
    series: [{
      type: 'pie',
      radius: ['55%', '80%'],
      center: ['50%', '42%'],
      avoidLabelOverlap: false,
      itemStyle: {
        borderRadius: 6,
        borderColor: dark ? '#1f2937' : '#fff',
        borderWidth: 3
      },
      label: {
        show: true,
        position: 'center',
        formatter: `{count|${total}}\n{label|Active 사용자}`,
        rich: {
          count: {
            fontSize: 28,
            fontWeight: 'bold',
            color: dark ? '#fff' : '#111827',
            lineHeight: 36
          },
          label: {
            fontSize: 12,
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
      animationDelay: (idx) => idx * 200,
      data: data.length > 0
        ? data
        : [{ value: 1, name: 'No Data', itemStyle: { color: dark ? '#374151' : '#e5e7eb' } }]
    }]
  }
})
</script>

<template>
  <div class="w-full h-full flex items-center justify-center" style="min-height: 280px">
    <VChart :option="option" autoresize style="width: 100%; height: 280px" />
  </div>
</template>
