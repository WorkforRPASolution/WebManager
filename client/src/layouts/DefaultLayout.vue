<script setup>
import { watch } from 'vue'
import { useRoute } from 'vue-router'
import Header from './Header.vue'
import Sidebar from './Sidebar.vue'
import TabBar from './TabBar.vue'
import { useMenuStore } from '../shared/stores/menu'
import { useTabsStore } from '../shared/stores/tabs'

const route = useRoute()
const menuStore = useMenuStore()
const tabsStore = useTabsStore()

// 라우트 변경 시 탭 열기 및 메뉴 상태 업데이트
watch(
  () => route.path,
  (path) => {
    // Skip non-default layout routes (e.g., unauthorized, login)
    if (route.meta?.layout !== 'default') {
      return
    }

    if (route.meta?.mainMenu) {
      menuStore.setActiveMainMenu(route.meta.mainMenu)
    } else {
      const mainMenu = menuStore.findMainMenuByPath(path)
      menuStore.setActiveMainMenu(mainMenu)
    }

    // 탭 열기
    tabsStore.openTab(route)
  },
  { immediate: true }
)
</script>

<template>
  <div class="min-h-screen flex flex-col bg-gray-100 dark:bg-dark-bg">
    <!-- Header -->
    <Header />

    <!-- Main Content Area -->
    <div class="flex flex-1 min-h-0">
      <!-- Sidebar -->
      <Sidebar />

      <!-- Page Content -->
      <main class="flex-1 overflow-y-auto p-6 bg-white dark:bg-dark-bg">
        <!-- 탭이 없을 때 빈 상태 표시 -->
        <div v-if="tabsStore.tabs.length === 0" class="flex items-center justify-center h-full">
          <div class="text-center text-gray-400 dark:text-gray-500">
            <svg class="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 6h16M4 10h16M4 14h16M4 18h16"/>
            </svg>
            <p class="text-lg">사이드바에서 메뉴를 선택하세요</p>
          </div>
        </div>
        <slot v-else />
      </main>
    </div>

    <!-- Tab Bar -->
    <TabBar />
  </div>
</template>
