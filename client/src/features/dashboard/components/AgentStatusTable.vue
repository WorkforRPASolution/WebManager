<script setup>
import { computed } from 'vue'

const props = defineProps({
  data: { type: Array, default: () => [] },
  groupByModel: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  redisAvailable: { type: Boolean, default: true }
})

const totalAgentCount = computed(() => props.data.reduce((sum, r) => sum + r.agentCount, 0))
const totalRunningCount = computed(() => props.data.reduce((sum, r) => sum + r.runningCount, 0))
const totalStoppedCount = computed(() => props.data.reduce((sum, r) => sum + (r.stoppedCount || 0), 0))
const totalNeverStarted = computed(() => totalAgentCount.value - totalRunningCount.value - totalStoppedCount.value)

function rateText(agent, running) {
  if (agent === 0) return '—'
  return ((running / agent) * 100).toFixed(0) + '%'
}

function rateClass(agent, running) {
  if (agent === 0) return 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
  if (running === agent) return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
  if (running > 0) return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
  return 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
}
</script>

<template>
  <div>
    <!-- Redis warning -->
    <div
      v-if="data.length > 0 && !redisAvailable"
      class="mb-4 px-4 py-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-sm text-yellow-700 dark:text-yellow-400"
    >
      Redis 미연결 상태입니다. Running Count가 정확하지 않을 수 있습니다.
    </div>

    <!-- Empty state -->
    <div
      v-if="data.length === 0 && !loading"
      class="text-center py-8 text-gray-400 dark:text-gray-500 text-sm"
    >
      조회 버튼을 눌러 Agent 상태를 확인하세요.
    </div>

    <!-- Table -->
    <table v-else-if="data.length > 0" class="w-full text-sm">
      <thead>
        <tr class="border-b border-gray-200 dark:border-dark-border">
          <th class="text-left py-3 px-4 font-semibold text-gray-600 dark:text-gray-300">Process</th>
          <th v-if="groupByModel" class="text-left py-3 px-4 font-semibold text-gray-600 dark:text-gray-300">Model</th>
          <th class="text-right py-3 px-4 font-semibold text-gray-600 dark:text-gray-300">Agent Count</th>
          <th class="text-right py-3 px-4 font-semibold text-gray-600 dark:text-gray-300">Running</th>
          <th class="text-right py-3 px-4 font-semibold text-gray-600 dark:text-gray-300">Stopped</th>
          <th class="text-right py-3 px-4 font-semibold text-gray-600 dark:text-gray-300">Never Started</th>
          <th class="text-right py-3 px-4 font-semibold text-gray-600 dark:text-gray-300">Rate</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(row, idx) in data"
          :key="idx"
          class="border-b border-gray-100 dark:border-dark-border/50 hover:bg-gray-50 dark:hover:bg-dark-border/30 transition-colors"
        >
          <td class="py-3 px-4 font-medium text-gray-900 dark:text-white">{{ row.process }}</td>
          <td v-if="groupByModel" class="py-3 px-4 text-gray-700 dark:text-gray-300">{{ row.eqpModel }}</td>
          <td class="py-3 px-4 text-right text-gray-700 dark:text-gray-300">{{ row.agentCount }}</td>
          <td class="py-3 px-4 text-right">
            <span :class="row.runningCount > 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-400'">
              {{ row.runningCount }}
            </span>
          </td>
          <td class="py-3 px-4 text-right">
            <span :class="(row.stoppedCount || 0) > 0 ? 'text-orange-500 dark:text-orange-400' : 'text-gray-400'">
              {{ row.stoppedCount || 0 }}
            </span>
          </td>
          <td class="py-3 px-4 text-right">
            <span class="text-gray-400 dark:text-gray-500">
              {{ row.agentCount - row.runningCount - (row.stoppedCount || 0) }}
            </span>
          </td>
          <td class="py-3 px-4 text-right">
            <span
              class="inline-block min-w-[3rem] text-center px-2 py-0.5 rounded-full text-xs font-medium"
              :class="rateClass(row.agentCount, row.runningCount)"
            >
              {{ rateText(row.agentCount, row.runningCount) }}
            </span>
          </td>
        </tr>
      </tbody>
      <tfoot>
        <tr class="border-t-2 border-gray-300 dark:border-dark-border font-semibold">
          <td class="py-3 px-4 text-gray-900 dark:text-white">Total</td>
          <td v-if="groupByModel" class="py-3 px-4"></td>
          <td class="py-3 px-4 text-right text-gray-900 dark:text-white">{{ totalAgentCount }}</td>
          <td class="py-3 px-4 text-right text-green-600 dark:text-green-400">{{ totalRunningCount }}</td>
          <td class="py-3 px-4 text-right text-orange-500 dark:text-orange-400">{{ totalStoppedCount }}</td>
          <td class="py-3 px-4 text-right text-gray-400 dark:text-gray-500">{{ totalNeverStarted }}</td>
          <td class="py-3 px-4 text-right">
            <span class="inline-block min-w-[3rem] text-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
              {{ rateText(totalAgentCount, totalRunningCount) }}
            </span>
          </td>
        </tr>
      </tfoot>
    </table>
  </div>
</template>
