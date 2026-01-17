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
    <div class="flex flex-1 overflow-hidden">
      <!-- Sidebar -->
      <Sidebar />

      <!-- Page Content -->
      <main class="flex-1 overflow-y-auto p-6 bg-white dark:bg-dark-bg">
        <slot />
      </main>
    </div>

    <!-- Tab Bar -->
    <TabBar />
  </div>
</template>
