<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { authApi } from '@/shared/api'

const router = useRouter()

const singleid = ref('')
const loading = ref(false)
const error = ref('')
const success = ref(false)

const handleSubmit = async () => {
  if (!singleid.value.trim()) {
    error.value = '사용자 ID를 입력해주세요'
    return
  }

  loading.value = true
  error.value = ''

  try {
    const response = await authApi.requestPasswordReset(singleid.value.trim())
    if (response.data.success) {
      success.value = true
    }
  } catch (err) {
    error.value = err.response?.data?.error || '요청에 실패했습니다'
  } finally {
    loading.value = false
  }
}

const goToLogin = () => {
  router.push('/login')
}
</script>

<template>
  <div class="w-full max-w-md">
    <div class="bg-white dark:bg-dark-card rounded-2xl shadow-xl p-8">
      <!-- Logo -->
      <div class="text-center mb-6">
        <div class="w-16 h-16 bg-primary-500 rounded-xl flex items-center justify-center mx-auto mb-4">
          <svg class="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="3"/>
            <circle cx="6" cy="6" r="2"/>
            <circle cx="18" cy="6" r="2"/>
            <circle cx="6" cy="18" r="2"/>
            <circle cx="18" cy="18" r="2"/>
          </svg>
        </div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Password Reset</h1>
        <p class="text-gray-500 dark:text-gray-400 mt-2">Request a password reset</p>
      </div>

      <!-- Success Message -->
      <div v-if="success" class="text-center py-6">
        <div class="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg class="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">Request Submitted</h2>
        <p class="text-gray-600 dark:text-gray-400 mb-6">
          Your password reset request has been submitted. Once approved by an administrator, you can log in and set a new password.
        </p>
        <button
          @click="goToLogin"
          class="px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition"
        >
          Back to Login
        </button>
      </div>

      <!-- Form -->
      <form v-else @submit.prevent="handleSubmit" class="space-y-4">
        <!-- Info -->
        <div class="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <div class="flex gap-3">
            <svg class="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p class="text-sm text-blue-700 dark:text-blue-300">
              Enter your user ID below. Once your request is approved by an administrator, you'll be able to set a new password when you log in.
            </p>
          </div>
        </div>

        <!-- Error Message -->
        <div v-if="error" class="p-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-sm">
          {{ error }}
        </div>

        <!-- User ID -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            User ID
          </label>
          <input
            v-model="singleid"
            type="text"
            class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition"
            placeholder="Enter your user ID"
            autofocus
          />
        </div>

        <!-- Submit -->
        <button
          type="submit"
          :disabled="loading || !singleid.trim()"
          class="w-full py-3 px-4 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span v-if="loading">Submitting...</span>
          <span v-else>Request Reset</span>
        </button>

        <!-- Back to Login -->
        <div class="text-center">
          <router-link to="/login" class="text-sm text-primary-500 hover:text-primary-600 font-medium">
            Back to Login
          </router-link>
        </div>
      </form>
    </div>
  </div>
</template>
