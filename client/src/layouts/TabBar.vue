<script setup>
import { useRouter } from 'vue-router'
import { useTabsStore } from '../shared/stores/tabs'
import { useMenuStore } from '../shared/stores/menu'

const router = useRouter()
const tabsStore = useTabsStore()
const menuStore = useMenuStore()

const handleTabClick = (tab) => {
  tabsStore.setActiveTab(tab.id)
  menuStore.setActiveMainMenu(tab.mainMenu)
  router.push(tab.path)
}

const handleCloseTab = (e, tab) => {
  e.stopPropagation()
  const nextTab = tabsStore.closeTab(tab.id)
  if (nextTab) {
    menuStore.setActiveMainMenu(nextTab.mainMenu)
    router.push(nextTab.path)
  } else if (tabsStore.tabs.length === 0) {
    router.push('/')
  }
}

const handleAddTab = () => {
  router.push('/')
}
</script>

<template>
  <footer class="bg-gray-100 dark:bg-dark-card border-t border-gray-200 dark:border-dark-border h-10 flex items-end px-2 shrink-0">
    <div class="flex gap-1 h-full items-end overflow-x-auto">
      <!-- Tabs -->
      <button
        v-for="tab in tabsStore.tabs"
        :key="tab.id"
        @click="handleTabClick(tab)"
        class="group flex items-center gap-2 px-4 h-8 rounded-t-lg border-x border-t text-xs font-medium transition-colors shrink-0"
        :class="tab.id === tabsStore.activeTabId
          ? 'bg-white dark:bg-dark-bg border-gray-200 dark:border-dark-border text-primary-500'
          : 'bg-gray-50 dark:bg-dark-border/50 border-transparent text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-dark-border'"
      >
        <span class="max-w-[120px] truncate">{{ tab.label }}</span>
        <span
          v-if="tab.closable"
          @click="(e) => handleCloseTab(e, tab)"
          class="w-4 h-4 flex items-center justify-center rounded hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-400 hover:text-red-500 transition-colors"
        >
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </span>
      </button>

      <!-- Add Tab Button -->
      <button
        @click="handleAddTab"
        class="px-2 h-8 text-gray-400 hover:text-primary-500 transition-colors shrink-0"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
        </svg>
      </button>
    </div>
  </footer>
</template>
