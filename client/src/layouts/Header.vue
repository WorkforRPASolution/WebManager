<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useMenuStore } from '../shared/stores/menu'
import { useTabsStore } from '../shared/stores/tabs'
import { useAuthStore } from '../shared/stores/auth'
import { useTheme } from '../shared/composables/useTheme'
import AppIcon from '../shared/components/AppIcon.vue'

const router = useRouter()
const menuStore = useMenuStore()
const tabsStore = useTabsStore()
const authStore = useAuthStore()
const { isDark, toggleTheme } = useTheme()

const userInitial = computed(() => {
  const name = authStore.user?.name || 'U'
  return name.charAt(0).toUpperCase()
})

const userName = computed(() => authStore.user?.name || 'User')
const userEmail = computed(() => authStore.user?.email || '')

const lastLoginText = computed(() => {
  const lastLoginAt = authStore.user?.lastLoginAt
  if (!lastLoginAt) return null
  const date = new Date(lastLoginAt)
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${mm}/${dd} ${hh}:${min}`
})

const handleSubMenuClick = (subMenu, mainMenuId) => {
  menuStore.setActiveMainMenu(mainMenuId)
  menuStore.closeMegaMenu()
  router.push(subMenu.path)
}

const handleLogout = async () => {
  tabsStore.closeAllTabs()
  await authStore.logout()
  router.push('/login')
}
</script>

<template>
  <header class="h-14 bg-primary-500 flex items-center px-4 shrink-0 shadow-md z-50">
    <!-- Logo -->
    <div class="flex items-center gap-3">
      <div class="w-8 h-8 bg-white/20 rounded flex items-center justify-center">
        <svg class="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="3"/>
          <circle cx="6" cy="6" r="2"/>
          <circle cx="18" cy="6" r="2"/>
          <circle cx="6" cy="18" r="2"/>
          <circle cx="18" cy="18" r="2"/>
        </svg>
      </div>
      <span class="text-white font-bold text-lg tracking-tight">WebManager</span>
    </div>

    <!-- Main Menu Navigation -->
    <nav class="ml-8 flex h-full">
      <div
        v-for="menu in menuStore.menuItems"
        :key="menu.id"
        class="relative group flex items-center h-full"
      >
        <button
          class="flex items-center gap-1 px-4 h-full text-white/90 hover:text-white hover:bg-white/10 font-medium transition-colors"
          :class="{ 'bg-white/10 text-white': menuStore.activeMainMenu === menu.id }"
          @click="menuStore.setActiveMainMenu(menu.id)"
        >
          {{ menu.label }}
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
          </svg>
        </button>

        <!-- Mega Menu Dropdown -->
        <div class="hidden group-hover:block absolute top-14 left-0 min-w-[280px] bg-white dark:bg-dark-card shadow-xl border border-gray-200 dark:border-dark-border rounded-b-lg overflow-hidden">
          <div class="p-4">
            <h3 class="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
              {{ menu.label }}
            </h3>
            <ul class="space-y-1">
              <li v-for="subMenu in menu.subMenus" :key="subMenu.id">
                <button
                  @click="handleSubMenuClick(subMenu, menu.id)"
                  class="w-full text-left px-3 py-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:text-primary-600 dark:hover:text-primary-400 transition-colors flex items-center gap-2"
                >
                  <AppIcon :name="subMenu.icon" size="4" class="text-gray-400" />
                  <span class="font-medium">{{ subMenu.label }}</span>
                </button>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </nav>

    <!-- Right Side: Theme Toggle, Notifications, User -->
    <div class="ml-auto flex items-center gap-2">
      <!-- Theme Toggle -->
      <button
        @click="toggleTheme"
        class="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
      >
        <svg v-if="isDark" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/>
        </svg>
        <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/>
        </svg>
      </button>

      <!-- Notifications -->
      <button class="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors relative">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
        </svg>
        <span class="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
      </button>

      <!-- User Menu -->
      <div class="relative group">
        <button class="flex items-center gap-2 p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
          <div class="w-7 h-7 bg-white/20 rounded-full flex items-center justify-center">
            <span class="text-sm font-medium">{{ userInitial }}</span>
          </div>
        </button>

        <!-- User Dropdown -->
        <div class="hidden group-hover:block absolute top-full right-0 mt-1 w-56 bg-white dark:bg-dark-card shadow-xl border border-gray-200 dark:border-dark-border rounded-lg overflow-hidden">
          <div class="p-3 border-b border-gray-100 dark:border-dark-border">
            <p class="font-medium text-gray-900 dark:text-white text-sm">{{ userName }}</p>
            <p v-if="userEmail" class="text-xs text-gray-500 dark:text-gray-400">{{ userEmail }}</p>
            <div class="mt-1 flex items-center gap-1">
              <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-400">
                {{ authStore.roleName }}
              </span>
            </div>
            <p v-if="lastLoginText" class="mt-1 text-xs text-gray-400 dark:text-gray-500">
              Last login: {{ lastLoginText }}
            </p>
          </div>
          <button
            @click="handleLogout"
            class="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-border flex items-center gap-2"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
            </svg>
            Sign out
          </button>
        </div>
      </div>
    </div>
  </header>
</template>
