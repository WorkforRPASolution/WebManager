<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/shared/stores/auth'
import { authApi } from '@/shared/api'

const router = useRouter()
const authStore = useAuthStore()

const password = ref('')
const passwordConfirm = ref('')
const loading = ref(false)
const error = ref('')
const fieldErrors = ref({})

const isFormValid = computed(() => {
  return password.value.length >= 8 &&
    password.value === passwordConfirm.value &&
    /[A-Za-z]/.test(password.value) &&
    /[0-9]/.test(password.value)
})

const validatePassword = () => {
  const errors = {}

  if (password.value.length < 8) {
    errors.password = '비밀번호는 8자 이상이어야 합니다'
  } else if (!/[A-Za-z]/.test(password.value) || !/[0-9]/.test(password.value)) {
    errors.password = '비밀번호는 영문과 숫자를 포함해야 합니다'
  }

  if (password.value !== passwordConfirm.value) {
    errors.passwordConfirm = '비밀번호가 일치하지 않습니다'
  }

  fieldErrors.value = errors
  return Object.keys(errors).length === 0
}

const handleSubmit = async () => {
  if (!validatePassword()) return

  loading.value = true
  error.value = ''

  try {
    const response = await authApi.setNewPassword(password.value)
    if (response.data.success) {
      // Refresh user data
      await authStore.fetchUser()
      // Navigate to dashboard
      router.push('/')
    }
  } catch (err) {
    error.value = err.response?.data?.error || '비밀번호 설정에 실패했습니다'
  } finally {
    loading.value = false
  }
}

const handleLogout = async () => {
  await authStore.logout()
  router.push('/login')
}
</script>

<template>
  <div class="w-full max-w-md">
    <div class="bg-white dark:bg-dark-card rounded-2xl shadow-xl p-8">
      <!-- Logo -->
      <div class="text-center mb-6">
        <div class="w-16 h-16 bg-amber-500 rounded-xl flex items-center justify-center mx-auto mb-4">
          <svg class="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Set New Password</h1>
        <p class="text-gray-500 dark:text-gray-400 mt-2">Please set a new password to continue</p>
      </div>

      <!-- Form -->
      <form @submit.prevent="handleSubmit" class="space-y-4">
        <!-- Info -->
        <div class="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
          <div class="flex gap-3">
            <svg class="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p class="text-sm text-amber-700 dark:text-amber-300">
              Your password has been reset by an administrator. Please set a new password to continue using the system.
            </p>
          </div>
        </div>

        <!-- Error Message -->
        <div v-if="error" class="p-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-sm">
          {{ error }}
        </div>

        <!-- Password -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            New Password
          </label>
          <input
            v-model="password"
            type="password"
            @blur="validatePassword"
            class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition"
            :class="{ 'border-red-500 dark:border-red-500': fieldErrors.password }"
            placeholder="Enter new password (min 8 characters)"
            autofocus
          />
          <p v-if="fieldErrors.password" class="mt-1 text-xs text-red-500">{{ fieldErrors.password }}</p>
          <p v-else class="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Must be at least 8 characters with letters and numbers
          </p>
        </div>

        <!-- Confirm Password -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Confirm Password
          </label>
          <input
            v-model="passwordConfirm"
            type="password"
            @blur="validatePassword"
            class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition"
            :class="{ 'border-red-500 dark:border-red-500': fieldErrors.passwordConfirm }"
            placeholder="Confirm new password"
          />
          <p v-if="fieldErrors.passwordConfirm" class="mt-1 text-xs text-red-500">{{ fieldErrors.passwordConfirm }}</p>
        </div>

        <!-- Submit -->
        <button
          type="submit"
          :disabled="loading || !isFormValid"
          class="w-full py-3 px-4 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span v-if="loading">Setting password...</span>
          <span v-else>Set Password</span>
        </button>

        <!-- Logout Link -->
        <div class="text-center">
          <button
            type="button"
            @click="handleLogout"
            class="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          >
            Logout and use a different account
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
