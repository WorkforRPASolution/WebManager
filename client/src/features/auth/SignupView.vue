<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import api, { authApi } from '@/shared/api'

const router = useRouter()
const route = useRoute()

// Form data
const form = ref({
  name: '',
  singleid: '',
  password: '',
  passwordConfirm: '',
  email: '',
  line: '',
  process: '',
  department: '',
  note: ''
})

// Options
const processes = ref([])
const lines = ref([])

// State
const loading = ref(false)
const error = ref('')
const success = ref(false)
const fieldErrors = ref({})

// Reset state when navigating to signup page
const resetState = () => {
  success.value = false
  error.value = ''
  fieldErrors.value = {}
  form.value = {
    name: '',
    singleid: '',
    password: '',
    passwordConfirm: '',
    email: '',
    line: '',
    process: '',
    department: '',
    note: ''
  }
}

// Watch route to reset state when re-entering signup page
watch(() => route.path, (newPath) => {
  if (newPath === '/signup') {
    resetState()
  }
}, { immediate: true })

// Validation
const isFormValid = computed(() => {
  return form.value.name.trim().length >= 2 &&
    form.value.singleid.trim().length >= 3 &&
    form.value.password.length >= 8 &&
    form.value.password === form.value.passwordConfirm &&
    form.value.email &&
    form.value.line &&
    form.value.process
})

// All available lines (loaded once)
const allLines = ref([])

// Load signup options on mount (public endpoint)
onMounted(async () => {
  try {
    const response = await api.get('/auth/signup-options')
    processes.value = response.data.processes || []
    allLines.value = response.data.lines || []
  } catch (err) {
    console.error('Failed to load signup options:', err)
    processes.value = []
    allLines.value = []
  }
})

// Filter lines when process changes
watch(() => form.value.process, (newProcess) => {
  // For now, show all lines - in the future, we could filter by process
  lines.value = allLines.value
  form.value.line = ''
})

const validateField = (field) => {
  const errors = {}

  if (field === 'name' || !field) {
    if (form.value.name.trim().length < 2) {
      errors.name = '이름은 2자 이상이어야 합니다'
    }
  }

  if (field === 'singleid' || !field) {
    if (form.value.singleid.trim().length < 3) {
      errors.singleid = 'ID는 3자 이상이어야 합니다'
    } else if (!/^[A-Za-z0-9_-]+$/.test(form.value.singleid)) {
      errors.singleid = 'ID는 영문, 숫자, _, -만 사용 가능합니다'
    }
  }

  if (field === 'password' || !field) {
    if (form.value.password.length < 8) {
      errors.password = '비밀번호는 8자 이상이어야 합니다'
    } else if (!/[A-Za-z]/.test(form.value.password) || !/[0-9]/.test(form.value.password)) {
      errors.password = '비밀번호는 영문과 숫자를 포함해야 합니다'
    }
  }

  if (field === 'passwordConfirm' || !field) {
    if (form.value.password !== form.value.passwordConfirm) {
      errors.passwordConfirm = '비밀번호가 일치하지 않습니다'
    }
  }

  if (field === 'email' || !field) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.value.email)) {
      errors.email = '유효한 이메일을 입력해주세요'
    }
  }

  if (field === 'process' || !field) {
    if (!form.value.process) {
      errors.process = 'Process를 선택해주세요'
    }
  }

  if (field === 'line' || !field) {
    if (!form.value.line) {
      errors.line = 'Line을 선택해주세요'
    }
  }

  if (field) {
    fieldErrors.value = { ...fieldErrors.value, ...errors }
    if (!errors[field]) {
      delete fieldErrors.value[field]
    }
  } else {
    fieldErrors.value = errors
  }

  return Object.keys(errors).length === 0
}

const handleSubmit = async () => {
  if (!validateField()) return
  if (!isFormValid.value) return

  loading.value = true
  error.value = ''
  fieldErrors.value = {}

  try {
    const response = await authApi.signup({
      name: form.value.name.trim(),
      singleid: form.value.singleid.trim(),
      password: form.value.password,
      email: form.value.email.trim(),
      line: form.value.line,
      process: form.value.process,
      department: form.value.department.trim(),
      note: form.value.note.trim()
    })

    if (response.data.success) {
      success.value = true
    }
  } catch (err) {
    const data = err.response?.data
    if (data?.details) {
      for (const detail of data.details) {
        fieldErrors.value[detail.field] = detail.message
      }
    } else {
      error.value = data?.error || '회원가입에 실패했습니다'
    }
  } finally {
    loading.value = false
  }
}

const goToLogin = () => {
  router.push('/login')
}
</script>

<template>
  <div class="w-full max-w-lg">
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
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">WebManager</h1>
        <p class="text-gray-500 dark:text-gray-400 mt-2">Create your account</p>
      </div>

      <!-- Success Message -->
      <div v-if="success" class="text-center py-8">
        <div class="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg class="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">Registration Complete</h2>
        <p class="text-gray-600 dark:text-gray-400 mb-6">
          Your account has been created. Please wait for administrator approval before logging in.
        </p>
        <button
          @click="goToLogin"
          class="px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition"
        >
          Go to Login
        </button>
      </div>

      <!-- Form -->
      <form v-else @submit.prevent="handleSubmit" class="space-y-4">
        <!-- Error Message -->
        <div v-if="error" class="p-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-sm">
          {{ error }}
        </div>

        <!-- Name -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Name <span class="text-red-500">*</span>
          </label>
          <input
            v-model="form.name"
            type="text"
            @blur="validateField('name')"
            class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition"
            :class="{ 'border-red-500 dark:border-red-500': fieldErrors.name }"
            placeholder="Enter your name"
          />
          <p v-if="fieldErrors.name" class="mt-1 text-xs text-red-500">{{ fieldErrors.name }}</p>
        </div>

        <!-- User ID -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            User ID <span class="text-red-500">*</span>
          </label>
          <input
            v-model="form.singleid"
            type="text"
            @blur="validateField('singleid')"
            class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition"
            :class="{ 'border-red-500 dark:border-red-500': fieldErrors.singleid }"
            placeholder="Enter your user ID"
          />
          <p v-if="fieldErrors.singleid" class="mt-1 text-xs text-red-500">{{ fieldErrors.singleid }}</p>
        </div>

        <!-- Password -->
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Password <span class="text-red-500">*</span>
            </label>
            <input
              v-model="form.password"
              type="password"
              @blur="validateField('password')"
              class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition"
              :class="{ 'border-red-500 dark:border-red-500': fieldErrors.password }"
              placeholder="Min 8 characters"
            />
            <p v-if="fieldErrors.password" class="mt-1 text-xs text-red-500">{{ fieldErrors.password }}</p>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Confirm <span class="text-red-500">*</span>
            </label>
            <input
              v-model="form.passwordConfirm"
              type="password"
              @blur="validateField('passwordConfirm')"
              class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition"
              :class="{ 'border-red-500 dark:border-red-500': fieldErrors.passwordConfirm }"
              placeholder="Confirm password"
            />
            <p v-if="fieldErrors.passwordConfirm" class="mt-1 text-xs text-red-500">{{ fieldErrors.passwordConfirm }}</p>
          </div>
        </div>

        <!-- Email -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Email <span class="text-red-500">*</span>
          </label>
          <input
            v-model="form.email"
            type="email"
            @blur="validateField('email')"
            class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition"
            :class="{ 'border-red-500 dark:border-red-500': fieldErrors.email }"
            placeholder="Enter your email"
          />
          <p v-if="fieldErrors.email" class="mt-1 text-xs text-red-500">{{ fieldErrors.email }}</p>
        </div>

        <!-- Process & Line -->
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Process <span class="text-red-500">*</span>
            </label>
            <select
              v-model="form.process"
              @blur="validateField('process')"
              class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition"
              :class="{ 'border-red-500 dark:border-red-500': fieldErrors.process }"
            >
              <option value="">Select Process</option>
              <option v-for="p in processes" :key="p" :value="p">{{ p }}</option>
            </select>
            <p v-if="fieldErrors.process" class="mt-1 text-xs text-red-500">{{ fieldErrors.process }}</p>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Line <span class="text-red-500">*</span>
            </label>
            <select
              v-model="form.line"
              @blur="validateField('line')"
              :disabled="!form.process"
              class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition disabled:opacity-50"
              :class="{ 'border-red-500 dark:border-red-500': fieldErrors.line }"
            >
              <option value="">Select Line</option>
              <option v-for="l in lines" :key="l" :value="l">{{ l }}</option>
            </select>
            <p v-if="fieldErrors.line" class="mt-1 text-xs text-red-500">{{ fieldErrors.line }}</p>
          </div>
        </div>

        <!-- Department -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Department
          </label>
          <input
            v-model="form.department"
            type="text"
            class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition"
            placeholder="Enter your department (optional)"
          />
        </div>

        <!-- Note -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Note
          </label>
          <textarea
            v-model="form.note"
            rows="2"
            class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition resize-none"
            placeholder="Additional notes (optional)"
          ></textarea>
        </div>

        <!-- Submit -->
        <button
          type="submit"
          :disabled="loading || !isFormValid"
          class="w-full py-3 px-4 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span v-if="loading">Creating account...</span>
          <span v-else>Sign Up</span>
        </button>

        <!-- Login Link -->
        <div class="text-center">
          <p class="text-sm text-gray-600 dark:text-gray-400">
            Already have an account?
            <router-link to="/login" class="text-primary-500 hover:text-primary-600 font-medium">
              Sign In
            </router-link>
          </p>
        </div>
      </form>
    </div>
  </div>
</template>
