<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/shared/stores/auth'
import { useTabsStore } from '@/shared/stores/tabs'

const router = useRouter()
const authStore = useAuthStore()
const tabsStore = useTabsStore()

const username = ref('')
const password = ref('')
const error = ref('')

/**
 * Find the first route the user has permission for
 */
const findFirstAccessibleRoute = () => {
  const routes = router.getRoutes()

  // Priority order for default landing pages
  const priorityPaths = ['/', '/clients', '/master']

  for (const path of priorityPaths) {
    const route = routes.find(r => r.path === path)
    if (route && route.meta?.permission) {
      if (authStore.hasPermission(route.meta.permission)) {
        return path
      }
    }
  }

  // Fallback: find any accessible route with default layout
  for (const route of routes) {
    if (route.meta?.layout === 'default' && route.meta?.permission) {
      if (authStore.hasPermission(route.meta.permission)) {
        return route.path
      }
    }
  }

  return '/unauthorized'
}

const handleLogin = async () => {
  if (!username.value || !password.value) {
    error.value = 'Please enter username and password'
    return
  }

  error.value = ''

  const result = await authStore.login(username.value, password.value)

  if (result.success) {
    // Clear any existing tabs from previous session
    tabsStore.closeAllTabs()

    // Check if password change is required
    if (result.mustChangePassword) {
      router.push('/set-new-password')
      return
    }

    // Navigate to first accessible route
    const targetPath = findFirstAccessibleRoute()
    router.push(targetPath)
  } else {
    error.value = result.error
  }
}
</script>

<template>
  <div class="w-full max-w-md">
    <div class="bg-white dark:bg-dark-card rounded-2xl shadow-xl p-8">
      <!-- Logo -->
      <div class="text-center mb-8">
        <div class="w-16 h-16 bg-primary-500 rounded-xl flex items-center justify-center mx-auto mb-4">
          <svg class="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="3"/>
            <circle cx="6" cy="6" r="2"/>
            <circle cx="18" cy="6" r="2"/>
            <circle cx="6" cy="18" r="2"/>
            <circle cx="18" cy="18" r="2"/>
          </svg>
        </div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">WebManager</h1>
        <p class="text-gray-500 dark:text-gray-400 mt-2">Sign in to your account</p>
      </div>

      <!-- Error Message -->
      <div v-if="error" class="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-sm">
        {{ error }}
      </div>

      <!-- Form -->
      <form @submit.prevent="handleLogin" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Username
          </label>
          <input
            v-model="username"
            type="text"
            class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition"
            placeholder="Enter your username"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Password
          </label>
          <input
            v-model="password"
            type="password"
            class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition"
            placeholder="Enter your password"
          />
        </div>

        <!-- Forgot Password Link -->
        <div class="text-right">
          <router-link
            to="/request-password-reset"
            class="text-sm text-primary-500 hover:text-primary-600"
          >
            Forgot password?
          </router-link>
        </div>

        <button
          type="submit"
          :disabled="authStore.loading"
          class="w-full py-3 px-4 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span v-if="authStore.loading">Signing in...</span>
          <span v-else>Sign In</span>
        </button>

        <!-- Sign Up Link -->
        <div class="text-center">
          <p class="text-sm text-gray-600 dark:text-gray-400">
            Don't have an account?
            <router-link to="/signup" class="text-primary-500 hover:text-primary-600 font-medium">
              Sign Up
            </router-link>
          </p>
        </div>
      </form>

      <!-- Test Credentials Hint -->
      <div class="mt-6 text-center">
        <p class="text-xs text-gray-400 dark:text-gray-500">
          Test credentials: admin/admin, manager/manager, user/user, guest/guest
        </p>
      </div>
    </div>
  </div>
</template>
