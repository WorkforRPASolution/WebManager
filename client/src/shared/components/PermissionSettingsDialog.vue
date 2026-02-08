<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 z-50 flex items-center justify-center"
      @click.self="handleClose"
    >
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-black/50"></div>

      <!-- Dialog -->
      <div class="relative bg-white dark:bg-dark-card rounded-xl shadow-2xl w-[700px] max-h-[85vh] overflow-hidden">
        <!-- Header -->
        <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-dark-border">
          <div>
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
              {{ featureName }} Permissions
            </h2>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              Configure {{ columnLabels.read }}/{{ columnLabels.write }}/{{ columnLabels.delete }} permissions for each role
            </p>
          </div>
          <button
            @click="handleClose"
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

          <div v-else-if="permissionData" class="space-y-4">
            <!-- Permission Table -->
            <table class="w-full">
              <thead>
                <tr class="text-left text-sm text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-dark-border">
                  <th class="pb-3 font-medium">Role</th>
                  <th class="pb-3 font-medium text-center w-24">{{ columnLabels.read }}</th>
                  <th class="pb-3 font-medium text-center w-24">{{ columnLabels.write }}</th>
                  <th class="pb-3 font-medium text-center w-24">{{ columnLabels.delete }}</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="role in roles"
                  :key="role.level"
                  class="border-b border-gray-100 dark:border-dark-border/50"
                >
                  <td class="py-3">
                    <div class="flex items-center gap-2">
                      <span class="font-medium text-gray-900 dark:text-white">
                        {{ role.name }}
                      </span>
                      <span class="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-dark-border text-gray-500 dark:text-gray-400">
                        Level {{ role.level }}
                      </span>
                    </div>
                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {{ role.description }}
                    </p>
                  </td>
                  <td class="py-3 text-center">
                    <ToggleSwitch
                      :model-value="getPermission(role.level, 'read')"
                      @update:model-value="setPermission(role.level, 'read', $event)"
                      :disabled="role.level === 1"
                    />
                  </td>
                  <td class="py-3 text-center">
                    <ToggleSwitch
                      :model-value="getPermission(role.level, 'write')"
                      @update:model-value="setPermission(role.level, 'write', $event)"
                      :disabled="role.level === 1"
                    />
                  </td>
                  <td class="py-3 text-center">
                    <ToggleSwitch
                      :model-value="getPermission(role.level, 'delete')"
                      @update:model-value="setPermission(role.level, 'delete', $event)"
                      :disabled="role.level === 1"
                    />
                  </td>
                </tr>
              </tbody>
            </table>

            <!-- Info Note -->
            <div class="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm">
              <svg class="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div class="text-gray-600 dark:text-gray-300">
                <p><strong>Admin</strong> permissions cannot be modified and always have full access.</p>
                <p class="mt-1"><strong>Write</strong> includes both create and edit operations.</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-dark-border">
          <button
            @click="handleClose"
            class="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-border rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            @click="handleSave"
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
import { ref, computed, watch } from 'vue'
import { permissionsApi } from '../api'
import ToggleSwitch from './ToggleSwitch.vue'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  feature: { type: String, required: true }
})

const emit = defineEmits(['update:modelValue', 'saved', 'error'])

const permissionData = ref(null)
const originalData = ref(null)
const loading = ref(false)
const saving = ref(false)

const featureNames = {
  equipmentInfo: 'Equipment Info',
  emailTemplate: 'Email Template',
  users: 'User Management',
  arsAgent: 'ARS Agent'
}

const roles = [
  { level: 1, name: 'Admin', description: 'Full system access' },
  { level: 2, name: 'Conductor', description: 'Senior user with elevated privileges' },
  { level: 3, name: 'Manager', description: 'Team manager' },
  { level: 0, name: 'User', description: 'Standard user' }
]

const featureColumnLabels = {
  arsAgent: { read: 'Monitoring', write: 'Operations', delete: 'Deploy' }
}

const columnLabels = computed(() => {
  return featureColumnLabels[props.feature] || { read: 'Read', write: 'Write', delete: 'Delete' }
})

const featureName = computed(() => featureNames[props.feature] || props.feature)

const hasChanges = computed(() => {
  if (!permissionData.value || !originalData.value) return false
  return JSON.stringify(permissionData.value.permissions) !== JSON.stringify(originalData.value.permissions)
})

const getPermission = (roleLevel, action) => {
  return permissionData.value?.permissions?.[roleLevel]?.[action] ?? false
}

const setPermission = (roleLevel, action, value) => {
  if (!permissionData.value?.permissions) return
  if (roleLevel === 1) return // Admin cannot be modified

  if (!permissionData.value.permissions[roleLevel]) {
    permissionData.value.permissions[roleLevel] = { read: false, write: false, delete: false }
  }

  permissionData.value.permissions[roleLevel][action] = value
}

const fetchPermission = async () => {
  loading.value = true
  try {
    const response = await permissionsApi.getByFeature(props.feature)
    permissionData.value = JSON.parse(JSON.stringify(response.data))
    originalData.value = JSON.parse(JSON.stringify(response.data))
  } catch (error) {
    console.error('Failed to fetch permission:', error)
    // Initialize with defaults if not found
    permissionData.value = {
      feature: props.feature,
      permissions: {
        0: { read: false, write: false, delete: false },
        1: { read: true, write: true, delete: true },
        2: { read: true, write: false, delete: false },
        3: { read: true, write: false, delete: false }
      }
    }
    originalData.value = JSON.parse(JSON.stringify(permissionData.value))
  } finally {
    loading.value = false
  }
}

const handleSave = async () => {
  if (!hasChanges.value) return

  saving.value = true
  try {
    await permissionsApi.update(props.feature, permissionData.value.permissions)
    originalData.value = JSON.parse(JSON.stringify(permissionData.value))
    emit('saved')
    emit('update:modelValue', false)
  } catch (error) {
    console.error('Failed to save permissions:', error)
    const message = error.response?.data?.message || 'Failed to save permissions'
    emit('error', message)
  } finally {
    saving.value = false
  }
}

const handleClose = () => {
  emit('update:modelValue', false)
}

watch(() => props.modelValue, (newVal) => {
  if (newVal) {
    fetchPermission()
  }
})
</script>
