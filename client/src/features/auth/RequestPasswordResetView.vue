<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { authApi } from '@/shared/api'
import EarsUserSearch from '@/shared/components/EarsUserSearch.vue'

const router = useRouter()

// --- Common state ---
const operationMode = ref('standalone')
const loading = ref(false)
const error = ref('')

// --- Standalone mode state ---
const singleid = ref('')
const success = ref(false)
const successMessage = ref('')

// --- Integrated mode state ---
const currentStep = ref(1)
const selectedUser = ref(null)       // { cn, department, mail, employeeNumber }
const verificationCode = ref('')
const sendingCode = ref(false)
const verifying = ref(false)
const stepError = ref('')

// New password (Step 4)
const newPassword = ref('')
const confirmPassword = ref('')
const settingPassword = ref(false)

// Countdown timer for verification code expiry (5 minutes = 300 seconds)
const codeExpirySeconds = ref(0)
let codeExpiryTimer = null

// Resend cooldown (60 seconds)
const resendCooldownSeconds = ref(0)
let resendCooldownTimer = null

// --- Computed ---
const steps = [
  { num: 1, label: '이름 검색' },
  { num: 2, label: '선택 확인' },
  { num: 3, label: '인증 코드' },
  { num: 4, label: '비밀번호 설정' },
  { num: 5, label: '완료' }
]

const codeExpiryDisplay = computed(() => {
  const m = Math.floor(codeExpirySeconds.value / 60)
  const s = codeExpirySeconds.value % 60
  return `${m}:${s.toString().padStart(2, '0')}`
})

const isCodeExpired = computed(() => codeExpirySeconds.value <= 0 && currentStep.value === 3)

const canResend = computed(() => resendCooldownSeconds.value <= 0 && !sendingCode.value)

const passwordError = computed(() => {
  if (!newPassword.value) return ''
  if (newPassword.value.length < 8) return '8자 이상이어야 합니다'
  if (!/[A-Za-z]/.test(newPassword.value) || !/[0-9]/.test(newPassword.value)) return '영문과 숫자를 포함해야 합니다'
  return ''
})

const canSubmitPassword = computed(() => {
  return newPassword.value &&
    confirmPassword.value &&
    newPassword.value === confirmPassword.value &&
    !passwordError.value &&
    !settingPassword.value
})

// --- Lifecycle ---
onMounted(async () => {
  try {
    const res = await authApi.getOperationMode()
    operationMode.value = res.data.mode
  } catch {
    // fallback to standalone
  }
})

onUnmounted(() => {
  clearTimers()
})

// --- Timer helpers ---
function startCodeExpiryTimer() {
  clearCodeExpiryTimer()
  codeExpirySeconds.value = 300 // 5 minutes
  codeExpiryTimer = setInterval(() => {
    if (codeExpirySeconds.value > 0) {
      codeExpirySeconds.value--
    } else {
      clearCodeExpiryTimer()
    }
  }, 1000)
}

function clearCodeExpiryTimer() {
  if (codeExpiryTimer) {
    clearInterval(codeExpiryTimer)
    codeExpiryTimer = null
  }
}

function startResendCooldown() {
  clearResendCooldown()
  resendCooldownSeconds.value = 60
  resendCooldownTimer = setInterval(() => {
    if (resendCooldownSeconds.value > 0) {
      resendCooldownSeconds.value--
    } else {
      clearResendCooldown()
    }
  }, 1000)
}

function clearResendCooldown() {
  if (resendCooldownTimer) {
    clearInterval(resendCooldownTimer)
    resendCooldownTimer = null
  }
}

function clearTimers() {
  clearCodeExpiryTimer()
  clearResendCooldown()
}

// --- Standalone mode ---
const handleStandaloneSubmit = async () => {
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
      successMessage.value = response.data.message
    }
  } catch (err) {
    error.value = err.response?.data?.error || '요청에 실패했습니다'
  } finally {
    loading.value = false
  }
}

// --- Integrated mode: step handlers ---
const onUserSelected = (user) => {
  selectedUser.value = user
  stepError.value = ''
  currentStep.value = 2
}

const goBackToSearch = () => {
  selectedUser.value = null
  stepError.value = ''
  currentStep.value = 1
}

const sendCode = async () => {
  if (!selectedUser.value?.mail) return

  sendingCode.value = true
  stepError.value = ''

  try {
    await authApi.sendVerificationCode(selectedUser.value.mail)
    currentStep.value = 3
    verificationCode.value = ''
    startCodeExpiryTimer()
    startResendCooldown()
  } catch (err) {
    stepError.value = err.response?.data?.error || err.response?.data?.message || '인증 코드 발송에 실패했습니다'
  } finally {
    sendingCode.value = false
  }
}

const resendCode = async () => {
  if (!canResend.value || !selectedUser.value?.mail) return

  sendingCode.value = true
  stepError.value = ''

  try {
    await authApi.sendVerificationCode(selectedUser.value.mail)
    verificationCode.value = ''
    startCodeExpiryTimer()
    startResendCooldown()
  } catch (err) {
    stepError.value = err.response?.data?.error || err.response?.data?.message || '인증 코드 재발송에 실패했습니다'
  } finally {
    sendingCode.value = false
  }
}

const verifyCode = async () => {
  if (!verificationCode.value.trim() || !selectedUser.value?.mail) return

  verifying.value = true
  stepError.value = ''

  try {
    await authApi.checkVerificationCode(selectedUser.value.mail, verificationCode.value.trim())
    clearTimers()
    currentStep.value = 4
    newPassword.value = ''
    confirmPassword.value = ''
  } catch (err) {
    stepError.value = err.response?.data?.error || err.response?.data?.message || '인증에 실패했습니다'
  } finally {
    verifying.value = false
  }
}

const submitNewPassword = async () => {
  if (!canSubmitPassword.value || !selectedUser.value?.mail) return

  settingPassword.value = true
  stepError.value = ''

  try {
    await authApi.verifyAndReset(selectedUser.value.mail, verificationCode.value.trim(), newPassword.value)
    currentStep.value = 5
  } catch (err) {
    stepError.value = err.response?.data?.error || err.response?.data?.message || '비밀번호 설정에 실패했습니다'
  } finally {
    settingPassword.value = false
  }
}

// --- Navigation ---
const goToLogin = () => {
  router.push('/login')
}
</script>

<template>
  <div class="w-full" :class="operationMode === 'integrated' ? 'max-w-2xl' : 'max-w-md'">
    <div class="bg-white dark:bg-dark-card rounded-2xl shadow-xl p-8">
      <!-- Logo -->
      <div class="text-center mb-6">
        <div class="w-16 h-16 rounded-xl flex items-center justify-center mx-auto mb-4">
          <svg class="w-14 h-14" viewBox="0 0 100 100">
            <g opacity="0.88"><polygon points="5,78 50,65 95,78 50,91" fill="#b0d4e8"/><polygon points="5,78 50,91 50,97 5,84" fill="#7ea4be"/><polygon points="50,91 95,78 95,84 50,97" fill="#94bcd6"/></g>
            <g opacity="0.82"><polygon points="5,62 50,49 95,62 50,75" fill="#82c882"/><polygon points="5,62 50,75 50,80 5,67" fill="#58a858"/><polygon points="50,75 95,62 95,67 50,80" fill="#6eba6e"/></g>
            <g opacity="0.82"><polygon points="5,46 50,33 95,46 50,59" fill="#4aada6"/><polygon points="5,46 50,59 50,64 5,51" fill="#2c8e88"/><polygon points="50,59 95,46 95,51 50,64" fill="#3c9e98"/></g>
            <g opacity="0.78"><polygon points="5,30 50,17 95,30 50,43" fill="#6a9ed4"/><polygon points="5,30 50,43 50,48 5,35" fill="#4a7eb4"/><polygon points="50,43 95,30 95,35 50,48" fill="#5a8ec4"/></g>
          </svg>
        </div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Password Reset</h1>
        <p class="text-gray-500 dark:text-gray-400 mt-2">Request a password reset</p>
      </div>

      <!-- ========================================= -->
      <!-- STANDALONE MODE (unchanged from original) -->
      <!-- ========================================= -->
      <template v-if="operationMode === 'standalone'">
        <!-- Success Message -->
        <div v-if="success" class="text-center py-6">
          <div class="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg class="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">Request Submitted</h2>
          <p class="text-gray-600 dark:text-gray-400 mb-6">
            {{ successMessage || 'Your password reset request has been submitted. Once approved by an administrator, you can log in and set a new password.' }}
          </p>
          <button
            @click="goToLogin"
            class="px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition"
          >
            Back to Login
          </button>
        </div>

        <!-- Form -->
        <form v-else @submit.prevent="handleStandaloneSubmit" class="space-y-4">
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
      </template>

      <!-- ================================== -->
      <!-- INTEGRATED MODE (multi-step wizard) -->
      <!-- ================================== -->
      <template v-else>
        <!-- Step Indicator -->
        <div class="flex items-center justify-between mb-8">
          <template v-for="(step, idx) in steps" :key="step.num">
            <!-- Step circle + label -->
            <div class="flex flex-col items-center">
              <div
                class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors"
                :class="currentStep >= step.num
                  ? 'bg-primary-500 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'"
              >
                <svg v-if="currentStep > step.num" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
                </svg>
                <span v-else>{{ step.num }}</span>
              </div>
              <span
                class="text-xs mt-1 whitespace-nowrap"
                :class="currentStep >= step.num
                  ? 'text-primary-500 font-medium'
                  : 'text-gray-400 dark:text-gray-500'"
              >
                {{ step.label }}
              </span>
            </div>
            <!-- Connecting line -->
            <div
              v-if="idx < steps.length - 1"
              class="flex-1 h-0.5 mx-2 mb-5 transition-colors"
              :class="currentStep > step.num
                ? 'bg-primary-500'
                : 'bg-gray-200 dark:bg-gray-700'"
            />
          </template>
        </div>

        <!-- ==================== -->
        <!-- Step 1: 이름 검색 -->
        <!-- ==================== -->
        <div v-if="currentStep === 1" class="space-y-4">
          <div class="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div class="flex gap-3">
              <svg class="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p class="text-sm text-blue-700 dark:text-blue-300">
                이름을 검색하여 본인을 선택하세요. 등록된 이메일로 인증 코드가 발송됩니다.
              </p>
            </div>
          </div>

          <EarsUserSearch @select="onUserSelected" />

          <!-- Back to Login -->
          <div class="text-center pt-2">
            <router-link to="/login" class="text-sm text-primary-500 hover:text-primary-600 font-medium">
              Back to Login
            </router-link>
          </div>
        </div>

        <!-- ======================== -->
        <!-- Step 2: 선택 확인 -->
        <!-- ======================== -->
        <div v-if="currentStep === 2 && selectedUser" class="space-y-4">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white text-center">
            이 사용자가 맞습니까?
          </h3>

          <!-- User info card -->
          <div class="p-4 bg-gray-50 dark:bg-dark-bg rounded-lg border border-gray-200 dark:border-dark-border space-y-3">
            <div class="flex justify-between">
              <span class="text-sm text-gray-500 dark:text-gray-400">이름</span>
              <span class="text-sm font-medium text-gray-900 dark:text-white">{{ selectedUser.cn }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-sm text-gray-500 dark:text-gray-400">부서</span>
              <span class="text-sm font-medium text-gray-900 dark:text-white">{{ selectedUser.department || '-' }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-sm text-gray-500 dark:text-gray-400">이메일</span>
              <span class="text-sm font-medium text-primary-500">{{ selectedUser.mail }}</span>
            </div>
          </div>

          <!-- Error -->
          <div v-if="stepError" class="p-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-sm">
            {{ stepError }}
          </div>

          <!-- Buttons -->
          <div class="flex gap-3">
            <button
              @click="goBackToSearch"
              :disabled="sendingCode"
              class="flex-1 px-6 py-3 bg-gray-100 dark:bg-dark-border hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              아니오, 다시 검색
            </button>
            <button
              @click="sendCode"
              :disabled="sendingCode"
              class="flex-1 px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span v-if="sendingCode" class="flex items-center justify-center gap-2">
                <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                발송 중...
              </span>
              <span v-else>예, 인증 코드 발송</span>
            </button>
          </div>
        </div>

        <!-- ============================== -->
        <!-- Step 3: 인증 코드 입력 -->
        <!-- ============================== -->
        <div v-if="currentStep === 3" class="space-y-4">
          <!-- Timer / expiry message -->
          <div class="text-center">
            <p v-if="!isCodeExpired" class="text-sm text-gray-600 dark:text-gray-400">
              인증 코드가 이메일로 발송되었습니다.
              <span class="font-medium text-primary-500 ml-1">(남은 시간: {{ codeExpiryDisplay }})</span>
            </p>
            <p v-else class="text-sm text-red-500 dark:text-red-400 font-medium">
              인증 코드가 만료되었습니다.
            </p>
          </div>

          <!-- Code input -->
          <div>
            <input
              v-model="verificationCode"
              type="text"
              maxlength="6"
              placeholder="000000"
              class="w-full px-4 py-4 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition text-center text-2xl font-mono tracking-[0.5em]"
              :class="{ 'opacity-50': isCodeExpired }"
              :disabled="isCodeExpired"
              @keyup.enter="verifyCode"
            />
          </div>

          <!-- Error -->
          <div v-if="stepError" class="p-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-sm">
            {{ stepError }}
          </div>

          <!-- Resend + Verify buttons -->
          <div class="flex gap-3">
            <button
              @click="resendCode"
              :disabled="!canResend"
              class="px-6 py-3 bg-gray-100 dark:bg-dark-border hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span v-if="resendCooldownSeconds > 0">재발송 ({{ resendCooldownSeconds }}s)</span>
              <span v-else-if="sendingCode">발송 중...</span>
              <span v-else>재발송</span>
            </button>
            <button
              @click="verifyCode"
              :disabled="verifying || !verificationCode.trim() || isCodeExpired"
              class="flex-1 px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span v-if="verifying" class="flex items-center justify-center gap-2">
                <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                확인 중...
              </span>
              <span v-else>다음</span>
            </button>
          </div>
        </div>

        <!-- ================================ -->
        <!-- Step 4: 새 비밀번호 설정 -->
        <!-- ================================ -->
        <div v-if="currentStep === 4" class="space-y-4">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white text-center">
            새 비밀번호를 설정하세요
          </h3>

          <!-- Password rules -->
          <div class="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p class="text-sm text-blue-700 dark:text-blue-300">
              8자 이상, 영문과 숫자를 포함해야 합니다.
            </p>
          </div>

          <!-- New Password -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              새 비밀번호
            </label>
            <input
              v-model="newPassword"
              type="password"
              class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition"
              placeholder="새 비밀번호를 입력하세요"
              @keyup.enter="$refs.confirmInput?.focus()"
            />
            <p v-if="passwordError" class="mt-1 text-sm text-red-500 dark:text-red-400">{{ passwordError }}</p>
          </div>

          <!-- Confirm Password -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              비밀번호 확인
            </label>
            <input
              ref="confirmInput"
              v-model="confirmPassword"
              type="password"
              class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition"
              placeholder="비밀번호를 다시 입력하세요"
              @keyup.enter="submitNewPassword"
            />
            <p v-if="confirmPassword && newPassword !== confirmPassword" class="mt-1 text-sm text-red-500 dark:text-red-400">
              비밀번호가 일치하지 않습니다
            </p>
          </div>

          <!-- Error -->
          <div v-if="stepError" class="p-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-sm">
            {{ stepError }}
          </div>

          <!-- Submit -->
          <button
            @click="submitNewPassword"
            :disabled="!canSubmitPassword"
            class="w-full py-3 px-4 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span v-if="settingPassword" class="flex items-center justify-center gap-2">
              <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              설정 중...
            </span>
            <span v-else>비밀번호 설정</span>
          </button>
        </div>

        <!-- =================== -->
        <!-- Step 5: 완료 -->
        <!-- =================== -->
        <div v-if="currentStep === 5" class="text-center py-6 space-y-4">
          <div class="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
            <svg class="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <div>
            <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              비밀번호가 변경되었습니다.
            </h2>
            <p class="text-gray-600 dark:text-gray-400">
              새 비밀번호로 로그인하세요.
            </p>
          </div>

          <button
            @click="goToLogin"
            class="px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition"
          >
            로그인으로 이동
          </button>
        </div>
      </template>
    </div>
  </div>
</template>
