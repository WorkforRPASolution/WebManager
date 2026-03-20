<script setup>
import { ref } from 'vue'
import UserActivityToolUsageTab from './components/UserActivityToolUsageTab.vue'
import UserActivityScenarioTab from './components/UserActivityScenarioTab.vue'

const activeTab = ref('tool-usage')

const tabs = [
  { id: 'tool-usage', label: 'Tool Usage' },
  { id: 'scenario', label: 'Scenario' },
  { id: 'webmanager', label: 'WebManager', disabled: true }
]
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Header -->
    <div class="flex items-center justify-between px-6 pt-4 pb-2">
      <h1 class="text-xl font-bold text-gray-900 dark:text-white">User Activity</h1>
    </div>

    <!-- Tabs -->
    <div class="px-6 border-b border-gray-200 dark:border-dark-border">
      <div class="flex gap-0">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          @click="!tab.disabled && (activeTab = tab.id)"
          class="px-4 py-2.5 text-sm font-medium border-b-2 transition-colors"
          :class="[
            activeTab === tab.id
              ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
              : tab.disabled
                ? 'border-transparent text-gray-300 dark:text-gray-600 cursor-not-allowed'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-500 cursor-pointer'
          ]"
        >
          {{ tab.label }}
          <span v-if="tab.disabled" class="ml-1 text-[10px] text-gray-400 dark:text-gray-500">(준비 중)</span>
        </button>
      </div>
    </div>

    <!-- Tab Content -->
    <div class="flex-1 min-h-0 overflow-y-auto">
      <KeepAlive>
        <UserActivityToolUsageTab v-if="activeTab === 'tool-usage'" />
        <UserActivityScenarioTab v-else-if="activeTab === 'scenario'" />
        <div v-else class="flex items-center justify-center h-full text-gray-400 dark:text-gray-500">
          준비 중입니다
        </div>
      </KeepAlive>
    </div>
  </div>
</template>
