<script setup>
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/shared/stores/auth'
import { useTabsStore } from '@/shared/stores/tabs'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const tabsStore = useTabsStore()

const isLanding = computed(() => route.meta.layout === 'landing')

const username = ref('')
const password = ref('')
const showPassword = ref(false)
const error = ref('')
const errorCode = ref(null)

/**
 * Find the first route the user has permission for
 */
const findFirstAccessibleRoute = () => {
  const routes = router.getRoutes()

  // Priority order for default landing pages
  const priorityPaths = ['/', '/clients', '/equipment-info']

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
  errorCode.value = null

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
    errorCode.value = result.code
  }
}
</script>

<template>
  <div class="w-full max-w-md">
    <div :class="isLanding ? 'p-8' : 'bg-white dark:bg-dark-card rounded-2xl shadow-xl p-8'">
      <!-- Logo -->
      <div class="text-center mb-8">
        <div class="w-16 h-16 rounded-xl flex items-center justify-center mx-auto mb-4">
          <svg class="w-14 h-14" viewBox="0 0 100 100">
            <g opacity="0.9"><polygon points="5,70 50,54 95,70 50,86" fill="#b4c8dc"/><polygon points="5,70 50,86 50,92 5,76" fill="#8aa0b8"/><polygon points="50,86 95,70 95,76 50,92" fill="#9eb4cc"/></g>
            <g opacity="0.85"><polygon points="5,48 50,32 95,48 50,64" fill="#48b0a8"/><polygon points="5,48 50,64 50,70 5,54" fill="#2c908a"/><polygon points="50,64 95,48 95,54 50,70" fill="#3aa09a"/></g>
            <g opacity="0.82"><polygon points="5,26 50,10 95,26 50,42" fill="#5c9ee0"/><polygon points="5,26 50,42 50,48 5,32" fill="#3878c0"/><polygon points="50,42 95,26 95,32 50,48" fill="#4a8cd0"/></g>
          </svg>
        </div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">WebManager</h1>
        <p class="text-gray-500 dark:text-gray-400 mt-2">Sign in to your account</p>
      </div>

      <!-- Error Message -->
      <div v-if="error" class="mb-4 p-3 rounded-lg text-sm" :class="errorCode === 'NO_PASSWORD'
        ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
        : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'">
        <p>{{ error }}</p>
        <router-link
          v-if="errorCode === 'NO_PASSWORD'"
          to="/request-password-reset"
          class="inline-block mt-2 text-sm font-medium text-amber-800 dark:text-amber-300 underline hover:no-underline"
        >
          비밀번호 초기화 요청하기
        </router-link>
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
          <div class="relative">
            <input
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              class="w-full px-4 py-3 pr-11 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition"
              placeholder="Enter your password"
            />
            <button
              type="button"
              @click="showPassword = !showPassword"
              class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              tabindex="-1"
            >
              <svg v-if="showPassword" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
              </svg>
              <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </button>
          </div>
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

    </div>
  </div>
</template>
