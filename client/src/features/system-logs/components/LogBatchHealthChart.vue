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
  data: { type: Array, default: () => [] }
})

const { isDark } = useTheme()

const SUCCESS_ACTIONS = ['cron_completed', 'backfill_completed', 'auto_backfill_completed']
const FAILED_ACTIONS = ['cron_failed', 'backfill_failed']
const SKIPPED_ACTIONS = ['cron_skipped']

const hasData = computed(() => props.data.length > 0)

const option = computed(() => {
  const dark = isDark.value

  let success = 0, failed = 0, skipped = 0, other = 0
  for (const item of props.data) {
    if (SUCCESS_ACTIONS.includes(item._id)) success += item.count
    else if (FAILED_ACTIONS.includes(item._id)) failed += item.count
    else if (SKIPPED_ACTIONS.includes(item._id)) skipped += item.count
    else other += item.count
  }

  const seriesData = [
    { name: 'Success', value: success, itemStyle: { color: '#10b981' } },
    { name: 'Failed', value: failed, itemStyle: { color: '#ef4444' } },
    { name: 'Skipped', value: skipped, itemStyle: { color: '#9ca3af' } },
    { name: 'Other', value: other, itemStyle: { color: '#f59e0b' } }
  ].filter(d => d.value > 0)

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
      style="width: 100%; height: 280px"
    />
    <div
      v-else
      class="flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm"
      style="height: 280px"
    >
      No batch data
    </div>
  </div>
</template>
