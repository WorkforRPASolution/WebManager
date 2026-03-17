<script setup>
import RecoveryTop10Chart from './RecoveryTop10Chart.vue'
import RecoveryTriggerChart from './RecoveryTriggerChart.vue'

const props = defineProps({
  process: { type: String, required: true },
  drilldown: { type: Object, default: null }
})
</script>

<template>
  <div class="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 dark:bg-dark-bg rounded-lg mt-2 border border-gray-200 dark:border-dark-border">
    <div>
      <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Top 5 실패 시나리오</h4>
      <RecoveryTop10Chart
        v-if="drilldown?.topScenarios?.length"
        :data="drilldown.topScenarios.slice(0, 5)"
        color="#ef4444"
      />
      <div v-else class="flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm py-8">
        데이터가 없습니다
      </div>
    </div>
    <div>
      <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Top 5 실패 장비</h4>
      <RecoveryTop10Chart
        v-if="drilldown?.topEquipment?.length"
        :data="drilldown.topEquipment.slice(0, 5)"
        color="#f59e0b"
      />
      <div v-else class="flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm py-8">
        데이터가 없습니다
      </div>
    </div>
    <div>
      <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Trigger 분포</h4>
      <RecoveryTriggerChart
        v-if="drilldown?.triggerDistribution?.length"
        :data="drilldown.triggerDistribution"
      />
      <div v-else class="flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm py-8">
        데이터가 없습니다
      </div>
    </div>
  </div>
</template>
