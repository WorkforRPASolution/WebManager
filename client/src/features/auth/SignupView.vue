<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import api, { authApi } from '@/shared/api'
import MultiSelect from '@/shared/components/MultiSelect.vue'

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
  processes: [],
  department: '',
  note: '',
  authorityManager: 0,
  authority: ''
})

// Options
const processes = ref([])
const roles = ref([])
const authorities = ref([])

// Custom input mode for Process
const processInputMode = ref('select') // 'select' or 'custom'
const processCustomInput = ref('') // 직접 입력 모드용 텍스트

// Client search helper for Process selection
const clientSearchKeyword = ref('')
const clientSearchResults = ref([])
const clientSearchProcesses = ref([])
const clientSearching = ref(false)
const clientSearchDone = ref(false)

// State
const showPassword = ref(false)
const showPasswordConfirm = ref(false)
const loading = ref(false)
const error = ref('')
const success = ref(false)
const fieldErrors = ref({})

// ID duplicate check state
const idChecked = ref(null) // null=unchecked, true=available, false=duplicate
const idChecking = ref(false)

// Reset state when navigating to signup page
const resetState = () => {
  success.value = false
  error.value = ''
  fieldErrors.value = {}
  idChecked.value = null
  idChecking.value = false
  processInputMode.value = 'select'
  processCustomInput.value = ''
  clientSearchKeyword.value = ''
  clientSearchResults.value = []
  clientSearchProcesses.value = []
  clientSearchDone.value = false
  form.value = {
    name: '',
    singleid: '',
    password: '',
    passwordConfirm: '',
    email: '',
    line: '',
    processes: [],
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
    idChecked.value === true &&
    form.value.password.length >= 8 &&
    form.value.password === form.value.passwordConfirm &&
    form.value.email &&
    form.value.line &&
    form.value.processes.length > 0
})

// Load signup options on mount (public endpoint)
onMounted(async () => {
  try {
    const response = await api.get('/auth/signup-options')
    processes.value = response.data.processes || []
    roles.value = response.data.roles || []
    authorities.value = response.data.authorities || []
  } catch (err) {
    console.error('Failed to load signup options:', err)
    processes.value = []
    roles.value = []
    authorities.value = []
  }
})

// Reset ID check when singleid changes
watch(() => form.value.singleid, () => {
  idChecked.value = null
  delete fieldErrors.value.singleid
})

// Watch process input mode change
watch(processInputMode, (newMode) => {
  if (newMode === 'custom') {
    form.value.processes = []
    processCustomInput.value = ''
  } else {
    processCustomInput.value = ''
  }
})

// Sync custom input → processes array
watch(processCustomInput, (val) => {
  if (processInputMode.value === 'custom') {
    form.value.processes = val.split(';').map(p => p.trim()).filter(Boolean)
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
    } else if (!/^[A-Za-z0-9._-]+$/.test(form.value.singleid)) {
      errors.singleid = 'ID는 영문, 숫자, _, -, .만 사용 가능합니다'
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
    if (form.value.processes.length === 0) {
      errors.process = 'Process를 하나 이상 선택해주세요'
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

const checkIdDuplicate = async () => {
  if (!validateField('singleid')) return
  idChecking.value = true
  try {
    const response = await authApi.checkId(form.value.singleid.trim())
    if (response.data.available) {
      idChecked.value = true
      delete fieldErrors.value.singleid
    } else {
      idChecked.value = false
      fieldErrors.value.singleid = response.data.message || '이미 사용 중인 ID입니다'
    }
  } catch (err) {
    idChecked.value = false
    fieldErrors.value.singleid = err.response?.data?.error || 'ID 확인에 실패했습니다'
  } finally {
    idChecking.value = false
  }
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
      processes: form.value.processes,
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

// Client search for Process help
const searchClients = async () => {
  const keyword = clientSearchKeyword.value.trim()
  if (keyword.length < 2) return
  clientSearching.value = true
  try {
    const response = await authApi.searchClients(keyword)
    clientSearchResults.value = response.data.clients || []
    clientSearchProcesses.value = response.data.processes || []
    clientSearchDone.value = true
  } catch (err) {
    clientSearchResults.value = []
    clientSearchProcesses.value = []
    clientSearchDone.value = true
  } finally {
    clientSearching.value = false
  }
}

const addSearchedProcess = (proc) => {
  if (processInputMode.value === 'select') {
    if (!form.value.processes.includes(proc)) {
      form.value.processes = [...form.value.processes, proc]
    }
  }
}

const addAllSearchedProcesses = () => {
  if (processInputMode.value === 'select') {
    const merged = new Set([...form.value.processes, ...clientSearchProcesses.value])
    form.value.processes = [...merged]
  }
}

// Format process custom input (uppercase, allow semicolons)
const onProcessInput = (event) => {
  processCustomInput.value = event.target.value.toUpperCase().replace(/[^A-Z_;]/g, '')
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
        <div class="w-16 h-16 rounded-xl flex items-center justify-center mx-auto mb-4">
          <svg class="w-14 h-14" viewBox="0 0 100 100">
            <g opacity="0.9"><polygon points="5,70 50,54 95,70 50,86" fill="#b4c8dc"/><polygon points="5,70 50,86 50,92 5,76" fill="#8aa0b8"/><polygon points="50,86 95,70 95,76 50,92" fill="#9eb4cc"/></g>
            <g opacity="0.85"><polygon points="5,48 50,32 95,48 50,64" fill="#48b0a8"/><polygon points="5,48 50,64 50,70 5,54" fill="#2c908a"/><polygon points="50,64 95,48 95,54 50,70" fill="#3aa09a"/></g>
            <g opacity="0.82"><polygon points="5,26 50,10 95,26 50,42" fill="#5c9ee0"/><polygon points="5,26 50,42 50,48 5,32" fill="#3878c0"/><polygon points="50,42 95,26 95,32 50,48" fill="#4a8cd0"/></g>
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
          <div class="flex gap-2">
            <input
              v-model="form.singleid"
              type="text"
              @blur="validateField('singleid')"
              class="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition"
              :class="{
                'border-red-500 dark:border-red-500': fieldErrors.singleid,
                'border-green-500 dark:border-green-500': idChecked === true
              }"
              placeholder="Enter your user ID"
            />
            <button
              type="button"
              @click="checkIdDuplicate"
              :disabled="idChecking || form.singleid.trim().length < 3"
              class="px-4 py-2.5 rounded-lg text-sm font-medium transition whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
              :class="idChecked === true
                ? 'bg-green-500 text-white cursor-default'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'"
            >
              <span v-if="idChecking">확인 중...</span>
              <span v-else-if="idChecked === true">사용 가능</span>
              <span v-else>중복확인</span>
            </button>
          </div>
          <p v-if="fieldErrors.singleid" class="mt-1 text-xs text-red-500">{{ fieldErrors.singleid }}</p>
          <p v-else-if="idChecked === true" class="mt-1 text-xs text-green-500">사용 가능한 ID입니다</p>
        </div>

        <!-- Password -->
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Password <span class="text-red-500">*</span>
            </label>
            <div class="relative">
              <input
                v-model="form.password"
                :type="showPassword ? 'text' : 'password'"
                @blur="validateField('password')"
                class="w-full px-4 py-2.5 pr-11 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition"
                :class="{ 'border-red-500 dark:border-red-500': fieldErrors.password }"
                placeholder="Min 8 characters"
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
            <p v-if="fieldErrors.password" class="mt-1 text-xs text-red-500">{{ fieldErrors.password }}</p>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Confirm <span class="text-red-500">*</span>
            </label>
            <div class="relative">
              <input
                v-model="form.passwordConfirm"
                :type="showPasswordConfirm ? 'text' : 'password'"
                @blur="validateField('passwordConfirm')"
                class="w-full px-4 py-2.5 pr-11 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition"
                :class="{ 'border-red-500 dark:border-red-500': fieldErrors.passwordConfirm }"
                placeholder="Confirm password"
              />
              <button
                type="button"
                @click="showPasswordConfirm = !showPasswordConfirm"
                class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                tabindex="-1"
              >
                <svg v-if="showPasswordConfirm" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                </svg>
                <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </button>
            </div>
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

        <!-- Client Search Helper -->
        <div class="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <label class="block text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">
            Process 찾기
            <span class="text-xs font-normal text-blue-500 dark:text-blue-400 ml-1">담당 Client의 IP 또는 장비 ID로 검색</span>
          </label>
          <div class="flex gap-2">
            <input
              v-model="clientSearchKeyword"
              type="text"
              @keyup.enter="searchClients"
              class="flex-1 px-3 py-2 text-sm rounded-lg border border-blue-300 dark:border-blue-700 bg-white dark:bg-dark-bg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-400 focus:border-transparent transition"
              placeholder="IP 또는 장비 ID 입력 (예: 10.0.1, CVD_EQP)"
            />
            <button
              type="button"
              @click="searchClients"
              :disabled="clientSearching || clientSearchKeyword.trim().length < 2"
              class="px-4 py-2 rounded-lg text-sm font-medium bg-blue-500 hover:bg-blue-600 text-white transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              <span v-if="clientSearching">검색 중...</span>
              <span v-else>검색</span>
            </button>
          </div>
          <!-- Search Results -->
          <div v-if="clientSearchDone" class="mt-2">
            <div v-if="clientSearchResults.length === 0" class="text-xs text-blue-500 dark:text-blue-400">
              검색 결과가 없습니다.
            </div>
            <div v-else>
              <!-- Found Processes -->
              <div class="flex items-center gap-2 mb-2">
                <span class="text-xs text-blue-600 dark:text-blue-300 font-medium">해당 Process:</span>
                <button
                  v-for="proc in clientSearchProcesses"
                  :key="proc"
                  type="button"
                  @click="addSearchedProcess(proc)"
                  class="px-2 py-0.5 text-xs rounded-full transition"
                  :class="form.processes.includes(proc)
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 cursor-default'
                    : 'bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-blue-700 cursor-pointer'"
                >
                  {{ proc }}
                  <span v-if="form.processes.includes(proc)" class="ml-0.5">&#10003;</span>
                  <span v-else class="ml-0.5">+</span>
                </button>
                <button
                  v-if="clientSearchProcesses.length > 1 && processInputMode === 'select'"
                  type="button"
                  @click="addAllSearchedProcesses"
                  class="px-2 py-0.5 text-xs rounded-full bg-blue-200 dark:bg-blue-700 text-blue-800 dark:text-blue-100 hover:bg-blue-300 dark:hover:bg-blue-600 transition"
                >
                  모두 추가
                </button>
              </div>
              <!-- Client List (compact) -->
              <div class="max-h-32 overflow-y-auto text-xs">
                <table class="w-full">
                  <thead>
                    <tr class="text-blue-500 dark:text-blue-400 border-b border-blue-200 dark:border-blue-700">
                      <th class="text-left py-1 pr-2">EQP ID</th>
                      <th class="text-left py-1 pr-2">IP</th>
                      <th class="text-left py-1">Process</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="c in clientSearchResults" :key="c.eqpId" class="text-gray-700 dark:text-gray-300">
                      <td class="py-0.5 pr-2 font-mono">{{ c.eqpId }}</td>
                      <td class="py-0.5 pr-2 font-mono">{{ c.ipAddr }}</td>
                      <td class="py-0.5">{{ c.process }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p v-if="clientSearchResults.length >= 50" class="text-xs text-blue-400 mt-1">
                최대 50건까지 표시됩니다. 더 구체적으로 검색해주세요.
              </p>
            </div>
          </div>
        </div>

        <!-- Process (Multi Select / Custom Input) -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Process <span class="text-red-500">*</span>
            <span class="text-xs text-gray-500 ml-1">(복수 선택 가능)</span>
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
            <!-- MultiSelect or Custom Input based on mode -->
            <div class="flex-1">
              <MultiSelect
                v-if="processInputMode === 'select'"
                v-model="form.processes"
                :options="processes"
                placeholder="Select Process"
                width="100%"
              />
              <input
                v-else
                :value="processCustomInput"
                @input="onProcessInput"
                @blur="validateField('process')"
                type="text"
                class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition uppercase"
                :class="{ 'border-red-500 dark:border-red-500': fieldErrors.process }"
                placeholder="세미콜론(;)으로 구분 (예: CVD;ETCH)"
              />
            </div>
          </div>
          <p v-if="fieldErrors.process" class="mt-1 text-xs text-red-500">{{ fieldErrors.process }}</p>
        </div>

        <!-- Line -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Line <span class="text-red-500">*</span>
            <span class="text-xs text-gray-500 ml-1">(한글 제외)</span>
          </label>
          <input
            v-model="form.line"
            @blur="validateField('line')"
            type="text"
            class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition"
            :class="{ 'border-red-500 dark:border-red-500': fieldErrors.line }"
            placeholder="Enter Line (e.g., P1, M1)"
          />
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
