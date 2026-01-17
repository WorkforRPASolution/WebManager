<script setup>
import { useTheme } from '../../shared/composables/useTheme'

const { isDark, toggleTheme } = useTheme()
</script>

<template>
  <div>
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
      <p class="text-gray-500 dark:text-gray-400 mt-1">Manage your preferences</p>
    </div>

    <div class="bg-white dark:bg-dark-card rounded-xl shadow-sm border border-gray-200 dark:border-dark-border">
      <!-- Theme Setting -->
      <div class="p-6 border-b border-gray-200 dark:border-dark-border">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-lg font-medium text-gray-900 dark:text-white">Theme</h3>
            <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Choose between light and dark mode
            </p>
          </div>
          <button
            @click="toggleTheme"
            class="relative inline-flex h-6 w-11 items-center rounded-full transition"
            :class="isDark ? 'bg-primary-500' : 'bg-gray-300'"
          >
            <span
              class="inline-block h-4 w-4 transform rounded-full bg-white transition"
              :class="isDark ? 'translate-x-6' : 'translate-x-1'"
            />
          </button>
        </div>
      </div>

      <!-- Placeholder Settings -->
      <div class="p-6 border-b border-gray-200 dark:border-dark-border">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-lg font-medium text-gray-900 dark:text-white">Notifications</h3>
            <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Receive alerts and notifications
            </p>
          </div>
          <button class="relative inline-flex h-6 w-11 items-center rounded-full bg-primary-500">
            <span class="inline-block h-4 w-4 transform rounded-full bg-white translate-x-6"/>
          </button>
        </div>
      </div>

      <div class="p-6">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-lg font-medium text-gray-900 dark:text-white">Auto Refresh</h3>
            <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Automatically refresh data every 30 seconds
            </p>
          </div>
          <button class="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-300">
            <span class="inline-block h-4 w-4 transform rounded-full bg-white translate-x-1"/>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
