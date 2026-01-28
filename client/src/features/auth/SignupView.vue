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
  note: '',
  authorityManager: 0,
  authority: ''
})

// Options
const processes = ref([])
const lines = ref([])
const roles = ref([])
const authorities = ref([])

// Custom input mode for Process and Line
const processInputMode = ref('select') // 'select' or 'custom'
const lineInputMode = ref('select') // 'select' or 'custom'

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
  processInputMode.value = 'select'
  lineInputMode.value = 'select'
  form.value = {
    name: '',
    singleid: '',
    password: '',
    passwordConfirm: '',
    email: '',
    line: '',
    process: '',
    department: '',
    note: '',
    authorityManager: 0,
    authority: ''
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
    lines.value = allLines.value
    roles.value = response.data.roles || []
    authorities.value = response.data.authorities || []
  } catch (err) {
    console.error('Failed to load signup options:', err)
    processes.value = []
    allLines.value = []
    roles.value = []
    authorities.value = []
  }
})

// Watch process input mode change
watch(processInputMode, (newMode) => {
  if (newMode === 'custom') {
    form.value.process = ''
  }
})

// Watch line input mode change
watch(lineInputMode, (newMode) => {
  if (newMode === 'custom') {
    form.value.line = ''
  }
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
      errors.process = 'Process를 입력해주세요'
    } else if (!/^[A-Z_]+$/.test(form.value.process)) {
      errors.process = 'Process는 영문 대문자와 언더바(_)만 사용 가능합니다'
    }
  }

  if (field === 'line' || !field) {
    if (!form.value.line) {
      errors.line = 'Line을 입력해주세요'
    } else if (/[\uAC00-\uD7A3]/.test(form.value.line)) {
      errors.line = 'Line에는 한글을 사용할 수 없습니다'
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
      line: form.value.line.trim(),
      process: form.value.process.trim(),
      department: form.value.department.trim(),
      note: form.value.note.trim(),
      authorityManager: form.value.authorityManager,
      authority: form.value.authority
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

// Format process value on input (convert to uppercase)
const onProcessInput = (event) => {
  form.value.process = event.target.value.toUpperCase().replace(/[^A-Z_]/g, '')
}

// Get role label for display
const getRoleLabel = (role) => {
  return `${role.name} - ${role.description}`
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

        <!-- Process with Combobox -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Process <span class="text-red-500">*</span>
            <span class="text-xs text-gray-500 ml-1">(영문 대문자, 언더바만)</span>
          </label>
          <div class="flex gap-2">
            <!-- Mode toggle buttons -->
            <div class="flex rounded-lg border border-gray-300 dark:border-dark-border overflow-hidden shrink-0">
              <button
                type="button"
                @click="processInputMode = 'select'"
                class="px-3 py-2 text-xs transition"
                :class="processInputMode === 'select'
                  ? 'bg-primary-500 text-white'
                  : 'bg-white dark:bg-dark-bg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'"
              >
                선택
              </button>
              <button
                type="button"
                @click="processInputMode = 'custom'"
                class="px-3 py-2 text-xs transition"
                :class="processInputMode === 'custom'
                  ? 'bg-primary-500 text-white'
                  : 'bg-white dark:bg-dark-bg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'"
              >
                직접 입력
              </button>
            </div>
            <!-- Select or Input based on mode -->
            <select
              v-if="processInputMode === 'select'"
              v-model="form.process"
              @blur="validateField('process')"
              class="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition"
              :class="{ 'border-red-500 dark:border-red-500': fieldErrors.process }"
            >
              <option value="">Select Process</option>
              <option v-for="p in processes" :key="p" :value="p">{{ p }}</option>
            </select>
            <input
              v-else
              :value="form.process"
              @input="onProcessInput"
              @blur="validateField('process')"
              type="text"
              class="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition uppercase"
              :class="{ 'border-red-500 dark:border-red-500': fieldErrors.process }"
              placeholder="Enter Process (e.g., ETCH, CVD)"
            />
          </div>
          <p v-if="fieldErrors.process" class="mt-1 text-xs text-red-500">{{ fieldErrors.process }}</p>
        </div>

        <!-- Line with Combobox -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Line <span class="text-red-500">*</span>
            <span class="text-xs text-gray-500 ml-1">(한글 제외)</span>
          </label>
          <div class="flex gap-2">
            <!-- Mode toggle buttons -->
            <div class="flex rounded-lg border border-gray-300 dark:border-dark-border overflow-hidden shrink-0">
              <button
                type="button"
                @click="lineInputMode = 'select'"
                class="px-3 py-2 text-xs transition"
                :class="lineInputMode === 'select'
                  ? 'bg-primary-500 text-white'
                  : 'bg-white dark:bg-dark-bg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'"
              >
                선택
              </button>
              <button
                type="button"
                @click="lineInputMode = 'custom'"
                class="px-3 py-2 text-xs transition"
                :class="lineInputMode === 'custom'
                  ? 'bg-primary-500 text-white'
                  : 'bg-white dark:bg-dark-bg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'"
              >
                직접 입력
              </button>
            </div>
            <!-- Select or Input based on mode -->
            <select
              v-if="lineInputMode === 'select'"
              v-model="form.line"
              @blur="validateField('line')"
              class="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition"
              :class="{ 'border-red-500 dark:border-red-500': fieldErrors.line }"
            >
              <option value="">Select Line</option>
              <option v-for="l in lines" :key="l" :value="l">{{ l }}</option>
            </select>
            <input
              v-else
              v-model="form.line"
              @blur="validateField('line')"
              type="text"
              class="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition"
              :class="{ 'border-red-500 dark:border-red-500': fieldErrors.line }"
              placeholder="Enter Line (e.g., P1, M1)"
            />
          </div>
          <p v-if="fieldErrors.line" class="mt-1 text-xs text-red-500">{{ fieldErrors.line }}</p>
        </div>

        <!-- AuthorityManager (Role) & Authority (RPA) -->
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              사용자 권한 <span class="text-red-500">*</span>
            </label>
            <select
              v-model="form.authorityManager"
              class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition text-sm"
            >
              <option v-for="role in roles" :key="role.level" :value="role.level">
                {{ getRoleLabel(role) }}
              </option>
            </select>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">관리자 승인 시 변경될 수 있음</p>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              RPA 권한
            </label>
            <select
              v-model="form.authority"
              class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition text-sm"
            >
              <option v-for="auth in authorities" :key="auth.value" :value="auth.value">
                {{ auth.label }}
              </option>
            </select>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">관리자 승인 시 변경될 수 있음</p>
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
