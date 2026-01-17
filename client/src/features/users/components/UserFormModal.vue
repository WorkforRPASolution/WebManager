<script setup>
import { ref, computed, onMounted } from 'vue'
import AppIcon from '../../../shared/components/AppIcon.vue'

const props = defineProps({
  user: {
    type: Object,
    default: null
  },
  roles: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['save', 'close'])

const form = ref({
  username: '',
  email: '',
  password: '',
  name: '',
  role: 'viewer',
  department: '',
  isActive: true
})

const errors = ref({})
const saving = ref(false)
const apiError = ref(null)

const isEdit = computed(() => !!props.user)
const title = computed(() => isEdit.value ? 'Edit User' : 'Add User')

onMounted(() => {
  if (props.user) {
    form.value = {
      username: props.user.username || '',
      email: props.user.email || '',
      password: '',
      name: props.user.name || '',
      role: props.user.role || 'viewer',
      department: props.user.department || '',
      isActive: props.user.isActive !== false
    }
  }
})

function validate() {
  errors.value = {}

  if (!form.value.username || form.value.username.trim().length < 3) {
    errors.value.username = 'Username must be at least 3 characters'
  }

  if (!form.value.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.value.email)) {
    errors.value.email = 'Invalid email format'
  }

  if (!isEdit.value && (!form.value.password || form.value.password.length < 4)) {
    errors.value.password = 'Password must be at least 4 characters'
  }

  if (!form.value.name || form.value.name.trim().length === 0) {
    errors.value.name = 'Name is required'
  }

  return Object.keys(errors.value).length === 0
}

async function handleSubmit() {
  if (!validate()) return

  saving.value = true
  apiError.value = null

  try {
    const data = { ...form.value }
    if (isEdit.value && !data.password) {
      delete data.password
    }
    await emit('save', data)
  } catch (err) {
    if (err.response?.data?.details) {
      err.response.data.details.forEach(d => {
        errors.value[d.field] = d.message
      })
    } else {
      apiError.value = err.response?.data?.error || 'Failed to save user'
    }
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center">
    <!-- Backdrop -->
    <div class="absolute inset-0 bg-black/50" @click="emit('close')"></div>

    <!-- Modal -->
    <div class="relative bg-white dark:bg-dark-card rounded-lg shadow-xl w-full max-w-md mx-4">
      <!-- Header -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-dark-border">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{{ title }}</h2>
        <button
          @click="emit('close')"
          class="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
        >
          <AppIcon name="x" size="5" />
        </button>
      </div>

      <!-- Body -->
      <form @submit.prevent="handleSubmit" class="p-6 space-y-4">
        <!-- API Error -->
        <div v-if="apiError" class="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
          {{ apiError }}
        </div>

        <!-- Username -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Username <span class="text-red-500">*</span>
          </label>
          <input
            v-model="form.username"
            type="text"
            class="w-full px-3 py-2 border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            :class="errors.username ? 'border-red-500' : 'border-gray-300 dark:border-dark-border'"
          />
          <p v-if="errors.username" class="mt-1 text-sm text-red-500">{{ errors.username }}</p>
        </div>

        <!-- Email -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Email <span class="text-red-500">*</span>
          </label>
          <input
            v-model="form.email"
            type="email"
            class="w-full px-3 py-2 border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            :class="errors.email ? 'border-red-500' : 'border-gray-300 dark:border-dark-border'"
          />
          <p v-if="errors.email" class="mt-1 text-sm text-red-500">{{ errors.email }}</p>
        </div>

        <!-- Password -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Password <span v-if="!isEdit" class="text-red-500">*</span>
            <span v-if="isEdit" class="text-gray-400 font-normal">(leave empty to keep current)</span>
          </label>
          <input
            v-model="form.password"
            type="password"
            class="w-full px-3 py-2 border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            :class="errors.password ? 'border-red-500' : 'border-gray-300 dark:border-dark-border'"
          />
          <p v-if="errors.password" class="mt-1 text-sm text-red-500">{{ errors.password }}</p>
        </div>

        <!-- Name -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Full Name <span class="text-red-500">*</span>
          </label>
          <input
            v-model="form.name"
            type="text"
            class="w-full px-3 py-2 border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            :class="errors.name ? 'border-red-500' : 'border-gray-300 dark:border-dark-border'"
          />
          <p v-if="errors.name" class="mt-1 text-sm text-red-500">{{ errors.name }}</p>
        </div>

        <!-- Role -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Role
          </label>
          <select
            v-model="form.role"
            class="w-full px-3 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
          >
            <option v-for="role in roles" :key="role.id" :value="role.id">
              {{ role.label }}
            </option>
          </select>
        </div>

        <!-- Department -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Department
          </label>
          <input
            v-model="form.department"
            type="text"
            class="w-full px-3 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        <!-- Active Status -->
        <div class="flex items-center gap-2">
          <input
            v-model="form.isActive"
            type="checkbox"
            id="isActive"
            class="w-4 h-4 rounded border-gray-300 text-primary-500 focus:ring-primary-500"
          />
          <label for="isActive" class="text-sm text-gray-700 dark:text-gray-300">
            Active user
          </label>
        </div>
      </form>

      <!-- Footer -->
      <div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-dark-border">
        <button
          type="button"
          @click="emit('close')"
          class="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-dark-border rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          Cancel
        </button>
        <button
          @click="handleSubmit"
          :disabled="saving"
          class="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <span v-if="saving" class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
          {{ saving ? 'Saving...' : 'Save' }}
        </button>
      </div>
    </div>
  </div>
</template>
