<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useMenuStore } from '../shared/stores/menu'
import AppIcon from '../shared/components/AppIcon.vue'

const route = useRoute()
const menuStore = useMenuStore()

const isActive = (path) => {
  if (path === '/') {
    return route.path === '/'
  }
  return route.path.startsWith(path)
}

const sidebarWidth = computed(() => {
  return menuStore.sidebarCollapsed ? 'w-16' : 'w-64'
})
</script>

<template>
  <aside
    class="bg-gray-50 dark:bg-dark-card border-r border-gray-200 dark:border-dark-border flex flex-col shrink-0 transition-all duration-300"
    :class="sidebarWidth"
  >
    <!-- Collapse Button -->
    <div class="p-2 border-b border-gray-200 dark:border-dark-border flex justify-end">
      <button
        @click="menuStore.toggleSidebar"
        class="p-1.5 hover:bg-gray-200 dark:hover:bg-dark-border rounded text-gray-500 dark:text-gray-400 transition-colors"
      >
        <svg
          class="w-4 h-4 transition-transform duration-300"
          :class="{ 'rotate-180': menuStore.sidebarCollapsed }"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
        </svg>
      </button>
    </div>

    <!-- Current Menu Title -->
    <div v-if="!menuStore.sidebarCollapsed" class="px-4 py-3 border-b border-gray-200 dark:border-dark-border">
      <span class="text-xs font-bold text-primary-500 uppercase tracking-wider">
        {{ menuStore.currentMainMenu?.label }}
      </span>
    </div>

    <!-- SubMenu Navigation -->
    <nav class="flex-1 p-2 overflow-y-auto">
      <ul class="space-y-1">
        <li v-for="subMenu in menuStore.currentSubMenus" :key="subMenu.id">
          <router-link
            :to="subMenu.path"
            class="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors"
            :class="isActive(subMenu.path)
              ? 'bg-primary-500 text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-dark-border'"
            :title="menuStore.sidebarCollapsed ? subMenu.label : ''"
          >
            <!-- Icon -->
            <AppIcon :name="subMenu.icon" class="shrink-0" />

            <!-- Label (hidden when collapsed) -->
            <span
              v-if="!menuStore.sidebarCollapsed"
              class="font-medium truncate"
            >
              {{ subMenu.label }}
            </span>
          </router-link>
        </li>
      </ul>
    </nav>
  </aside>
</template>
