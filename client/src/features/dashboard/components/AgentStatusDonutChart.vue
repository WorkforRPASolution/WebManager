<script setup>
import { computed, ref } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { PieChart } from 'echarts/charts'
import { TooltipComponent, LegendComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { useTheme } from '../../../shared/composables/useTheme'

use([PieChart, TooltipComponent, LegendComponent, CanvasRenderer])

const props = defineProps({
  totalAgent: { type: Number, default: 0 },
  totalRunning: { type: Number, default: 0 },
  totalStopped: { type: Number, default: 0 }
})

const { isDark } = useTheme()

const rate = computed(() => {
  if (props.totalAgent === 0) return 0
  return Math.round((props.totalRunning / props.totalAgent) * 100)
})

const neverStarted = computed(() => props.totalAgent - props.totalRunning - props.totalStopped)

const option = computed(() => {
  const dark = isDark.value
  return {
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} ({d}%)',
      backgroundColor: dark ? '#1f2937' : '#fff',
      borderColor: dark ? '#374151' : '#e5e7eb',
      textStyle: { color: dark ? '#e5e7eb' : '#111827' }
    },
    legend: {
      bottom: 0,
      textStyle: { color: dark ? '#9ca3af' : '#6b7280' }
    },
    series: [{
      type: 'pie',
      radius: ['55%', '80%'],
      center: ['50%', '45%'],
      avoidLabelOverlap: false,
      itemStyle: {
        borderRadius: 6,
        borderColor: dark ? '#1f2937' : '#fff',
        borderWidth: 3
      },
      label: {
        show: true,
        position: 'center',
        formatter: `{rate|${rate.value}%}\n{label|가동률}`,
        rich: {
          rate: {
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
      animationDelay: (idx) => idx * 200,
      data: [
        { value: props.totalRunning, name: 'Running', itemStyle: { color: dark ? '#4ade80' : '#22c55e' } },
        { value: props.totalStopped, name: 'Stopped', itemStyle: { color: dark ? '#f97316' : '#f59e0b' } },
        { value: neverStarted.value, name: 'Never Started', itemStyle: { color: dark ? '#374151' : '#e5e7eb' } }
      ]
    }]
  }
})
</script>

<template>
  <div class="w-full h-full flex items-center justify-center" style="min-height: 280px">
    <VChart :option="option" autoresize style="width: 100%; height: 280px" />
  </div>
</template>
