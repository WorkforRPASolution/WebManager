<script setup>
import { computed } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { PieChart } from 'echarts/charts'
import { TooltipComponent, LegendComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { useTheme } from '../../../shared/composables/useTheme'
import { getTriggerColor } from '../utils/recoveryColors'

use([PieChart, TooltipComponent, LegendComponent, CanvasRenderer])

const props = defineProps({
  data: { type: Array, default: () => [] }
})

const { isDark } = useTheme()

const option = computed(() => {
  const dark = isDark.value
  const grandTotal = props.data.reduce((sum, d) => sum + (d.total || 0), 0)

  const pieData = props.data.map(d => ({
    name: d.trigger_by || 'Unknown',
    value: d.total || 0,
    itemStyle: { color: getTriggerColor(d.trigger_by || 'Unknown', dark) }
  }))

  return {
    tooltip: {
      trigger: 'item',
      backgroundColor: dark ? '#1f2937' : '#fff',
      borderColor: dark ? '#374151' : '#e5e7eb',
      textStyle: { color: dark ? '#e5e7eb' : '#111827' },
      formatter: (p) => {
        const pct = grandTotal > 0 ? ((p.value / grandTotal) * 100).toFixed(1) : '0'
        return `${p.marker} ${p.name}: <b>${p.value.toLocaleString()}</b> (${pct}%)`
      }
    },
    legend: {
      orient: 'vertical',
      right: 10,
      top: 'center',
      textStyle: { color: dark ? '#9ca3af' : '#6b7280', fontSize: 12 },
      itemWidth: 12,
      itemHeight: 12,
      formatter: (name) => {
        const item = props.data.find(d => (d.trigger_by || 'Unknown') === name)
        const val = item?.total || 0
        const pct = grandTotal > 0 ? ((val / grandTotal) * 100).toFixed(0) : '0'
        return `${name}  ${pct}%`
      }
    },
    series: [{
      type: 'pie',
      radius: ['50%', '78%'],
      center: ['35%', '50%'],
      avoidLabelOverlap: false,
      itemStyle: {
        borderRadius: 5,
        borderColor: dark ? '#1f2937' : '#fff',
        borderWidth: 2
      },
      label: {
        show: true,
        position: 'center',
        formatter: `{total|${grandTotal.toLocaleString()}}\n{label|Total}`,
        rich: {
          total: {
            fontSize: 22,
            fontWeight: 'bold',
            color: dark ? '#fff' : '#111827',
            lineHeight: 30
          },
          label: {
            fontSize: 12,
            color: dark ? '#9ca3af' : '#6b7280',
            lineHeight: 18
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
      animationDelay: (idx) => idx * 150,
      data: pieData
    }]
  }
})
</script>

<template>
  <div class="w-full">
    <VChart
      v-if="data.length > 0"
      :option="option"
      autoresize
      style="width: 100%; height: 240px"
    />
    <div v-else class="flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm" style="height: 150px">
      데이터가 없습니다
    </div>
  </div>
</template>
