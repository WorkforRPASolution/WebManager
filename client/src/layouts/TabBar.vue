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

  // 닫으려는 탭이 현재 활성 탭인지 확인
  const isActiveTab = tab.id === tabsStore.activeTabId
  const nextTab = tabsStore.closeTab(tab.id)

  // 활성 탭을 닫은 경우에만 네비게이션
  if (isActiveTab && nextTab) {
    menuStore.setActiveMainMenu(nextTab.mainMenu)
    router.push(nextTab.path)
  }
  // 모든 탭이 닫힌 경우 빈 상태 유지 (네비게이션 없음)
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

    </div>
  </footer>
</template>
