<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 z-50 flex items-center justify-center"
      @click.self="$emit('update:modelValue', false)"
    >
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-black/50"></div>

      <!-- Dialog -->
      <div class="relative bg-white dark:bg-dark-card rounded-xl shadow-2xl w-[600px] max-h-[80vh] overflow-hidden">
        <!-- Header -->
        <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-dark-border">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Role Permission Settings</h2>
          <button
            @click="$emit('update:modelValue', false)"
            class="p-1 hover:bg-gray-100 dark:hover:bg-dark-border rounded-lg transition-colors"
          >
            <svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Content -->
        <div class="px-6 py-4 overflow-y-auto max-h-[60vh]">
          <div v-if="loading" class="flex items-center justify-center py-8">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
          </div>

          <div v-else class="space-y-4">
            <div v-for="role in roles" :key="role.roleLevel" class="border border-gray-200 dark:border-dark-border rounded-lg px-4 py-3">
              <div class="flex items-center justify-between mb-2">
                <div>
                  <h3 class="font-semibold text-gray-900 dark:text-white">{{ role.roleName }}</h3>
                  <p class="text-sm text-gray-500 dark:text-gray-400">Level {{ role.roleLevel }}</p>
                </div>
                <span class="text-xs text-gray-400">{{ role.description }}</span>
              </div>

              <div class="space-y-2">
                <div v-for="group in permissionGroups" :key="group.label">
                  <p class="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">{{ group.label }}</p>
                  <div class="grid grid-cols-3 gap-1.5 ml-1">
                    <label
                      v-for="perm in group.keys"
                      :key="perm"
                      v-show="role.permissions[perm] !== undefined"
                      class="flex items-center gap-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        :checked="role.permissions[perm]"
                        @change="updatePermission(role.roleLevel, perm, $event.target.checked)"
                        class="w-4 h-4 rounded border-gray-300 text-primary-500 focus:ring-primary-500"
                        :disabled="role.roleLevel === 1"
                      />
                      <span class="text-gray-700 dark:text-gray-300">{{ formatPermissionName(perm) }}</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-dark-border">
          <button
            @click="$emit('update:modelValue', false)"
            class="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-border rounded-lg transition-colors"
          >
            Close
          </button>
          <button
            @click="savePermissions"
            :disabled="saving || !hasChanges"
            class="px-4 py-2 bg-primary-500 hover:bg-primary-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white font-medium rounded-lg transition-colors"
          >
            {{ saving ? 'Saving...' : 'Save Changes' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, watch, computed } from 'vue'
import { usersApi } from '../api'

const props = defineProps({
  modelValue: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue', 'saved', 'error'])

const roles = ref([])
const originalRoles = ref([])
const loading = ref(false)
const saving = ref(false)

const hasChanges = computed(() => {
  return JSON.stringify(roles.value) !== JSON.stringify(originalRoles.value)
})

const formatPermissionName = (key) => {
  const names = {
    dashboard: 'Dashboard',
    arsAgent: 'ARS Agent',
    resourceAgent: 'Resource Agent',
    equipmentInfo: 'Equipment Info',
    emailTemplate: 'Email Template',
    popupTemplate: 'Popup Template',
    emailRecipients: 'Email Recipients',
    emailInfo: 'Email Info',
    emailImage: 'Email Image',
    alerts: 'Alerts',
    settings: 'Settings',
    users: 'Users'
  }
  return names[key] || key
}

const permissionGroups = [
  {
    label: 'Clients',
    keys: ['arsAgent', 'resourceAgent']
  },
  {
    label: '기준정보 관리',
    keys: ['equipmentInfo', 'emailTemplate', 'popupTemplate', 'emailRecipients', 'emailInfo', 'emailImage']
  },
  {
    label: 'System',
    keys: ['dashboard', 'alerts', 'settings', 'users']
  }
]

const fetchRoles = async () => {
  loading.value = true
  try {
    const response = await usersApi.getRoles()
    roles.value = JSON.parse(JSON.stringify(response.data))
    originalRoles.value = JSON.parse(JSON.stringify(response.data))
  } catch (error) {
    console.error('Failed to fetch roles:', error)
  } finally {
    loading.value = false
  }
}

const updatePermission = (level, key, value) => {
  const role = roles.value.find(r => r.roleLevel === level)
  if (role) {
    role.permissions[key] = value
  }
}

const savePermissions = async () => {
  saving.value = true
  try {
    for (const role of roles.value) {
      if (role.roleLevel === 1) continue // Skip admin (Level 1)

      const original = originalRoles.value.find(r => r.roleLevel === role.roleLevel)
      if (JSON.stringify(role.permissions) !== JSON.stringify(original?.permissions)) {
        await usersApi.updateRole(role.roleLevel, role.permissions)
      }
    }
    originalRoles.value = JSON.parse(JSON.stringify(roles.value))
    emit('saved')
  } catch (error) {
    console.error('Failed to save permissions:', error)
    emit('error', error.response?.data?.message || 'Failed to save role permissions')
  } finally {
    saving.value = false
  }
}

watch(() => props.modelValue, (newVal) => {
  if (newVal) {
    fetchRoles()
  }
})
</script>
