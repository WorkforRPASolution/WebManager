<script setup>
import { useRouter } from 'vue-router'
import RecoveryTop10Chart from './RecoveryTop10Chart.vue'

const props = defineProps({
  process: { type: String, required: true },
  drilldown: { type: Object, default: null },
  period: { type: String, default: 'today' }
})

const router = useRouter()

function navigateToAnalysis() {
  router.push({
    path: '/recovery-analysis',
    query: { process: props.process, period: props.period }
  })
}
</script>

<template>
  <div class="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-dark-bg rounded-lg mt-2 border border-gray-200 dark:border-dark-border">
    <div>
      <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Top 5 실패 시나리오</h4>
      <RecoveryTop10Chart
        v-if="drilldown?.topScenarios?.length"
        :data="drilldown.topScenarios.slice(0, 5)"
        title=""
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
        title=""
        color="#f59e0b"
      />
      <div v-else class="flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm py-8">
        데이터가 없습니다
      </div>
    </div>
    <div class="col-span-full text-right">
      <button
        @click="navigateToAnalysis"
        class="text-blue-600 dark:text-blue-400 text-sm hover:underline transition-colors"
      >
        Recovery Analysis 페이지로 이동 &rarr;
      </button>
    </div>
  </div>
</template>
