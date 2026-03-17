<script setup>
import { computed } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { PieChart } from 'echarts/charts'
import { TooltipComponent, LegendComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { useTheme } from '../../../shared/composables/useTheme'
import { getStatusColor } from '../utils/recoveryColors'

use([PieChart, TooltipComponent, LegendComponent, CanvasRenderer])

const props = defineProps({
  statusDistribution: { type: Object, default: () => ({}) },
  successRate: { type: Number, default: 0 }
})

const { isDark } = useTheme()

// Failed 그룹 합산용
const FAILED_GROUP = ['Failed', 'ScriptFailed', 'VisionDelayed', 'NotStarted']

const option = computed(() => {
  const dark = isDark.value
  const dist = props.statusDistribution

  // 그룹화된 데이터 생성
  const grouped = {}
  for (const [status, count] of Object.entries(dist)) {
    if (count <= 0) continue
    if (FAILED_GROUP.includes(status)) {
      grouped['Failed'] = (grouped['Failed'] || 0) + count
    } else {
      grouped[status] = (grouped[status] || 0) + count
    }
  }

  const data = Object.entries(grouped)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({
      value,
      name,
      itemStyle: { color: getStatusColor(name, dark) }
    }))

  const rateText = props.successRate != null ? props.successRate.toFixed(1) : '0'

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
        formatter: `{rate|${rateText}%}\n{label|성공률}`,
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
      data: data.length > 0 ? data : [{ value: 1, name: 'No Data', itemStyle: { color: dark ? '#374151' : '#e5e7eb' } }]
    }]
  }
})
</script>

<template>
  <div class="w-full h-full flex items-center justify-center" style="min-height: 280px">
    <VChart :option="option" autoresize style="width: 100%; height: 280px" />
  </div>
</template>
