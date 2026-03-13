<script setup>
import { ref } from 'vue'
import { authApi } from '@/shared/api'

const props = defineProps({
  disabled: { type: Boolean, default: false }
})

const emit = defineEmits(['select', 'clear'])

const searchName = ref('')
const results = ref([])
const selectedUser = ref(null)
const loading = ref(false)
const error = ref('')
const searched = ref(false)

const search = async () => {
  const name = searchName.value.trim()
  if (!name) return

  loading.value = true
  error.value = ''
  results.value = []
  selectedUser.value = null
  searched.value = true

  try {
    const res = await authApi.searchEarsUsers(name)
    results.value = res.data.data || []
  } catch (err) {
    error.value = err.response?.data?.message || '검색 중 오류가 발생했습니다'
  } finally {
    loading.value = false
  }
}

const selectUser = (user) => {
  selectedUser.value = user
  emit('select', {
    cn: user.cn,
    employeeNumber: user.employeeNumber,
    department: user.department,
    mail: user.mail
  })
}

const clearSelection = () => {
  selectedUser.value = null
  emit('clear')
}
</script>

<template>
  <div class="space-y-3">
    <!-- Search row -->
    <div class="flex gap-2">
      <input
        v-model="searchName"
        type="text"
        placeholder="이름으로 검색"
        :disabled="disabled"
        class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
        @keyup.enter="search"
      />
      <button
        :disabled="disabled || !searchName.trim() || loading"
        class="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        @click="search"
      >
        검색
      </button>
    </div>

    <!-- Loading spinner -->
    <div v-if="loading" class="flex items-center justify-center py-4">
      <svg class="animate-spin h-5 w-5 text-primary-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>
      <span class="ml-2 text-sm text-gray-500 dark:text-gray-400">검색 중...</span>
    </div>

    <!-- Error message -->
    <p v-if="error" class="text-sm text-red-500 dark:text-red-400">{{ error }}</p>

    <!-- Results table -->
    <div v-if="!loading && results.length > 0" class="border border-gray-200 dark:border-dark-border rounded-lg overflow-hidden">
      <div class="max-h-48 overflow-y-auto">
        <table class="w-full text-sm">
          <thead class="sticky top-0 bg-gray-50 dark:bg-dark-card">
            <tr>
              <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase" style="width: 36%">이름</th>
              <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase" style="width: 36%">부서</th>
              <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase" style="width: 28%">이메일</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200 dark:divide-dark-border">
            <tr
              v-for="(user, index) in results"
              :key="index"
              class="cursor-pointer"
              :class="selectedUser === user
                ? 'bg-primary-50 dark:bg-primary-900/20'
                : 'hover:bg-gray-50 dark:hover:bg-dark-border'"
              @click="selectUser(user)"
            >
              <td class="px-3 py-2 text-gray-900 dark:text-white">{{ user.cn }}</td>
              <td class="px-3 py-2 text-gray-700 dark:text-gray-300">{{ user.department }}</td>
              <td class="px-3 py-2 font-medium text-primary-500">{{ user.mail }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Empty result message -->
    <p v-if="!loading && searched && results.length === 0 && !error" class="text-sm text-gray-500 dark:text-gray-400 text-center py-3">
      검색 결과가 없습니다
    </p>

    <!-- Selected info -->
    <div v-if="selectedUser" class="flex items-center justify-between px-3 py-2 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg">
      <div class="text-sm text-gray-900 dark:text-white">
        <span class="font-medium">{{ selectedUser.cn }}</span>
        <span class="mx-1 text-gray-400">|</span>
        <span class="text-gray-600 dark:text-gray-300">{{ selectedUser.department }}</span>
        <span class="mx-1 text-gray-400">|</span>
        <span class="font-medium text-primary-500">{{ selectedUser.mail }}</span>
      </div>
      <button
        class="px-3 py-1 text-sm text-gray-600 dark:text-gray-300 hover:text-red-500 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-dark-border rounded transition"
        @click="clearSelection"
      >
        해제
      </button>
    </div>
  </div>
</template>
