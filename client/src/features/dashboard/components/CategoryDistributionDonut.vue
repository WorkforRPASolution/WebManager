<script setup>
import { computed } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { PieChart } from 'echarts/charts'
import { TooltipComponent, LegendComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { useTheme } from '../../../shared/composables/useTheme'
import { getCategoryColor } from '../utils/recoveryColors'

use([PieChart, TooltipComponent, LegendComponent, CanvasRenderer])

const props = defineProps({
  data: { type: Array, default: () => [] },
  valueKey: { type: [String, Array], default: 'total' },
  centerLabel: { type: String, default: 'Total' }
})

const { isDark } = useTheme()

const MAX_SLICES = 10

function getValue(d) {
  if (props.valueKey === 'total') return d.total || 0
  const sc = d.statusCounts || d.status_counts
  if (!sc) return 0
  if (Array.isArray(props.valueKey)) {
    return props.valueKey.reduce((sum, key) => sum + (sc[key] || 0), 0)
  }
  return sc[props.valueKey] || 0
}

const option = computed(() => {
  const dark = isDark.value
  const grandTotal = props.data.reduce((sum, d) => sum + getValue(d), 0)

  const sorted = [...props.data].sort((a, b) => getValue(b) - getValue(a))
  const top = sorted.slice(0, MAX_SLICES)
  const rest = sorted.slice(MAX_SLICES)
  const restTotal = rest.reduce((sum, d) => sum + getValue(d), 0)

  const pieData = top.map((d, i) => ({
    name: d.categoryName || `Category ${d.scCategory}`,
    value: getValue(d),
    itemStyle: { color: getCategoryColor(i, dark) }
  }))
  if (restTotal > 0) {
    pieData.push({
      name: `Others (${rest.length})`,
      value: restTotal,
      itemStyle: { color: dark ? '#4b5563' : '#9ca3af' }
    })
  }

  const legendCount = pieData.length
  const useVertical = legendCount <= 8

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
    legend: useVertical
      ? {
        orient: 'vertical',
        right: 10,
        top: 'center',
        textStyle: { color: dark ? '#9ca3af' : '#6b7280', fontSize: 11 },
        itemWidth: 10,
        itemHeight: 10,
        itemGap: 8,
        formatter: (name) => {
          const item = pieData.find(d => d.name === name)
          const val = item?.value || 0
          const pct = grandTotal > 0 ? ((val / grandTotal) * 100).toFixed(0) : '0'
          const displayName = name.length > 14 ? name.slice(0, 14) + '..' : name
          return `${displayName}  ${pct}%`
        }
      }
      : {
        type: 'scroll',
        orient: 'vertical',
        right: 10,
        top: 10,
        bottom: 10,
        textStyle: { color: dark ? '#9ca3af' : '#6b7280', fontSize: 11 },
        pageIconColor: dark ? '#9ca3af' : '#6b7280',
        pageIconInactiveColor: dark ? '#374151' : '#d1d5db',
        pageTextStyle: { color: dark ? '#9ca3af' : '#6b7280' },
        itemWidth: 10,
        itemHeight: 10,
        itemGap: 8,
        formatter: (name) => {
          const item = pieData.find(d => d.name === name)
          const val = item?.value || 0
          const pct = grandTotal > 0 ? ((val / grandTotal) * 100).toFixed(0) : '0'
          const displayName = name.length > 14 ? name.slice(0, 14) + '..' : name
          return `${displayName}  ${pct}%`
        }
      },
    series: [{
      type: 'pie',
      radius: ['48%', '76%'],
      center: ['32%', '50%'],
      avoidLabelOverlap: false,
      itemStyle: {
        borderRadius: 4,
        borderColor: dark ? '#1f2937' : '#fff',
        borderWidth: 2
      },
      label: {
        show: true,
        position: 'center',
        formatter: `{total|${grandTotal.toLocaleString()}}\n{label|${props.centerLabel}}`,
        rich: {
          total: {
            fontSize: 20,
            fontWeight: 'bold',
            color: dark ? '#fff' : '#111827',
            lineHeight: 26
          },
          label: {
            fontSize: 11,
            color: dark ? '#9ca3af' : '#6b7280',
            lineHeight: 16
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
      style="width: 100%; height: 100%"
    />
    <div v-else class="flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm h-full">
      데이터가 없습니다
    </div>
  </div>
</template>
