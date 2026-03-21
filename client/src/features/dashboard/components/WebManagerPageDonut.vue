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
  data: { type: Array, default: () => [] }
})

const { isDark } = useTheme()

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16']
const DARK_COLORS = ['#60A5FA', '#34D399', '#FBBF24', '#F87171', '#A78BFA', '#F472B6', '#2DD4BF', '#FB923C', '#818CF8', '#A3E635']

const totalVisits = computed(() => (props.data || []).reduce((s, d) => s + d.visitCount, 0))

const option = computed(() => {
  const items = props.data || []
  if (items.length === 0) return {}

  const dark = isDark.value
  const colors = dark ? DARK_COLORS : COLORS

  // Top 10 + 기타
  const sorted = [...items].sort((a, b) => b.visitCount - a.visitCount)
  const top10 = sorted.slice(0, 10)
  const rest = sorted.slice(10)
  const pieData = top10.map((d, i) => ({
    name: d.pageName,
    value: d.visitCount,
    itemStyle: { color: colors[i % colors.length] }
  }))
  if (rest.length > 0) {
    pieData.push({
      name: `기타 (${rest.length}개)`,
      value: rest.reduce((s, d) => s + d.visitCount, 0),
      itemStyle: { color: dark ? '#4b5563' : '#d1d5db' }
    })
  }

  const totalText = totalVisits.value.toLocaleString()

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
      textStyle: { color: dark ? '#9ca3af' : '#6b7280', fontSize: 11 },
      pageTextStyle: { color: dark ? '#9ca3af' : '#6b7280' },
      pageIconColor: dark ? '#9ca3af' : '#6b7280',
      pageIconInactiveColor: dark ? '#374151' : '#d1d5db'
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
        formatter: `{total|${totalText}}\n{label|총 방문}`,
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
      animationDelay: (idx) => idx * 200,
      data: pieData.length > 0 ? pieData : [{ value: 1, name: 'No Data', itemStyle: { color: dark ? '#374151' : '#e5e7eb' } }]
    }]
  }
})
</script>

<template>
  <div class="w-full h-full flex items-center justify-center" style="min-height: 280px">
    <VChart :option="option" autoresize style="width: 100%; height: 280px" />
  </div>
</template>
