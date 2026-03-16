<script setup>
import { ref, computed } from 'vue'
import { buildVersionColorMap } from '../utils/versionColors'
import { useTheme } from '../../../shared/composables/useTheme'

const props = defineProps({
  data: { type: Array, default: () => [] },
  allVersions: { type: Array, default: () => [] },
  groupByModel: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  redisAvailable: { type: Boolean, default: true }
})

const { isDark } = useTheme()

const expanded = ref(new Set())

function toggleGroup(key) {
  if (expanded.value.has(key)) {
    expanded.value.delete(key)
  } else {
    expanded.value.add(key)
  }
}

function groupKey(row) {
  return props.groupByModel ? `${row.process}\0${row.eqpModel}` : row.process
}

function groupLabel(row) {
  return props.groupByModel ? `${row.process} / ${row.eqpModel}` : row.process
}

function versionCount(row) {
  return Object.keys(row.versionCounts || {}).length
}

function sortedVersions(row) {
  const counts = row.versionCounts || {}
  return props.allVersions.filter(v => (counts[v] || 0) > 0)
}

function rate(count, total) {
  if (total === 0) return '—'
  return ((count / total) * 100).toFixed(0) + '%'
}

const colorMap = computed(() => buildVersionColorMap(props.allVersions, isDark.value))

const totalAgents = computed(() => props.data.reduce((sum, r) => sum + r.agentCount, 0))
const totalVersions = computed(() => props.allVersions.length)
</script>

<template>
  <div>
    <!-- Redis warning -->
    <div
      v-if="data.length > 0 && !redisAvailable"
      class="mb-4 px-4 py-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-sm text-yellow-700 dark:text-yellow-400"
    >
      Redis 미연결 상태입니다. 버전 정보가 정확하지 않을 수 있습니다.
    </div>

    <!-- Empty state -->
    <div
      v-if="data.length === 0 && !loading"
      class="text-center py-8 text-gray-400 dark:text-gray-500 text-sm"
    >
      조회 버튼을 눌러 버전 분포를 확인하세요.
    </div>

    <!-- Grouped Table -->
    <div v-else-if="data.length > 0" class="space-y-1">
      <!-- Summary -->
      <div class="text-sm text-gray-500 dark:text-gray-400 mb-3 px-1">
        총 {{ totalAgents }}개 Agent, {{ totalVersions }}개 버전
      </div>

      <!-- Groups -->
      <div
        v-for="row in data"
        :key="groupKey(row)"
        class="border border-gray-200 dark:border-dark-border rounded-lg"
      >
        <!-- Group Header (clickable) -->
        <button
          @click="toggleGroup(groupKey(row))"
          class="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-dark-border/30 transition-colors"
        >
          <div class="flex items-center gap-3">
            <!-- Expand icon -->
            <svg
              class="w-4 h-4 text-gray-400 transition-transform duration-200"
              :class="{ 'rotate-90': expanded.has(groupKey(row)) }"
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
            <!-- Process name -->
            <span class="font-medium text-gray-900 dark:text-white">{{ groupLabel(row) }}</span>
            <!-- Summary badges -->
            <span class="text-xs text-gray-500 dark:text-gray-400">
              {{ row.agentCount }} agents, {{ versionCount(row) }} versions
            </span>
          </div>
          <!-- Version mini-bar (stacked) with tooltip -->
          <div class="relative group/bar flex-shrink-0">
            <div class="flex h-3 w-32 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700">
              <div
                v-for="ver in sortedVersions(row)"
                :key="ver"
                :style="{
                  width: ((row.versionCounts[ver] / row.agentCount) * 100) + '%',
                  backgroundColor: colorMap[ver]
                }"
              />
            </div>
            <!-- Hover tooltip -->
            <div class="absolute top-full right-0 mt-2 hidden group-hover/bar:block z-50 pointer-events-none">
              <div class="bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg px-3 py-2 shadow-lg whitespace-nowrap">
                <div v-for="ver in sortedVersions(row)" :key="ver" class="flex items-center gap-2 py-0.5">
                  <span class="inline-block w-2 h-2 rounded-full" :style="{ backgroundColor: colorMap[ver] }" />
                  <span>{{ ver }}:</span>
                  <span class="font-medium">{{ row.versionCounts[ver] }}</span>
                  <span class="text-gray-400">({{ rate(row.versionCounts[ver], row.agentCount) }})</span>
                </div>
              </div>
            </div>
          </div>
        </button>

        <!-- Expanded Detail -->
        <div
          v-if="expanded.has(groupKey(row))"
          class="border-t border-gray-200 dark:border-dark-border"
        >
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-gray-100 dark:border-dark-border/50">
                <th class="text-left py-2 px-6 font-medium text-gray-500 dark:text-gray-400">Version</th>
                <th class="text-right py-2 px-6 font-medium text-gray-500 dark:text-gray-400">Count</th>
                <th class="text-right py-2 px-6 font-medium text-gray-500 dark:text-gray-400">Rate</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="ver in sortedVersions(row)"
                :key="ver"
                class="border-b border-gray-50 dark:border-dark-border/30 hover:bg-gray-50 dark:hover:bg-dark-border/20"
              >
                <td class="py-2 px-6">
                  <div class="flex items-center gap-2">
                    <span
                      class="inline-block w-2.5 h-2.5 rounded-full"
                      :style="{ backgroundColor: colorMap[ver] }"
                    />
                    <span class="text-gray-900 dark:text-white" :class="{ 'italic text-gray-400 dark:text-gray-500': ver === 'Unknown' }">
                      {{ ver }}
                    </span>
                  </div>
                </td>
                <td class="py-2 px-6 text-right text-gray-700 dark:text-gray-300">
                  {{ row.versionCounts[ver] }}
                </td>
                <td class="py-2 px-6 text-right">
                  <span class="inline-block min-w-[3rem] text-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                    {{ rate(row.versionCounts[ver], row.agentCount) }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>
