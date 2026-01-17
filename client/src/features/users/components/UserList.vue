<script setup>
import { ref, computed } from 'vue'
import AppIcon from '../../../shared/components/AppIcon.vue'

const props = defineProps({
  users: {
    type: Array,
    required: true
  },
  roles: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['edit', 'delete', 'selection-change'])

const selectedIds = ref(new Set())

const allSelected = computed(() => {
  return props.users.length > 0 && selectedIds.value.size === props.users.length
})

function toggleAll() {
  if (allSelected.value) {
    selectedIds.value = new Set()
  } else {
    selectedIds.value = new Set(props.users.map(u => u._id))
  }
  emitSelection()
}

function toggleSelect(userId) {
  if (selectedIds.value.has(userId)) {
    selectedIds.value.delete(userId)
  } else {
    selectedIds.value.add(userId)
  }
  selectedIds.value = new Set(selectedIds.value)
  emitSelection()
}

function emitSelection() {
  const selected = props.users.filter(u => selectedIds.value.has(u._id))
  emit('selection-change', selected)
}

function getRoleLabel(roleId) {
  const role = props.roles.find(r => r.id === roleId)
  return role ? role.label : roleId
}

function getRoleBadgeClass(role) {
  switch (role) {
    case 'admin':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
    case 'operator':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
  }
}

function formatDate(dateString) {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
}
</script>

<template>
  <div class="bg-white dark:bg-dark-card rounded-lg shadow-sm border border-gray-200 dark:border-dark-border overflow-hidden">
    <table class="w-full">
      <thead class="bg-gray-50 dark:bg-dark-border">
        <tr>
          <th class="w-12 px-4 py-3">
            <input
              type="checkbox"
              :checked="allSelected"
              @change="toggleAll"
              class="w-4 h-4 rounded border-gray-300 text-primary-500 focus:ring-primary-500"
            />
          </th>
          <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
            User
          </th>
          <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
            Role
          </th>
          <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
            Department
          </th>
          <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
            Status
          </th>
          <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
            Last Login
          </th>
          <th class="px-4 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
            Actions
          </th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-200 dark:divide-dark-border">
        <tr
          v-for="user in users"
          :key="user._id"
          class="hover:bg-gray-50 dark:hover:bg-dark-border/50 transition-colors"
        >
          <td class="px-4 py-3">
            <input
              type="checkbox"
              :checked="selectedIds.has(user._id)"
              @change="toggleSelect(user._id)"
              class="w-4 h-4 rounded border-gray-300 text-primary-500 focus:ring-primary-500"
            />
          </td>
          <td class="px-4 py-3">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                <span class="text-primary-600 dark:text-primary-400 font-semibold">
                  {{ user.name?.charAt(0)?.toUpperCase() || 'U' }}
                </span>
              </div>
              <div>
                <div class="font-medium text-gray-900 dark:text-white">{{ user.name }}</div>
                <div class="text-sm text-gray-500 dark:text-gray-400">{{ user.email }}</div>
                <div class="text-xs text-gray-400 dark:text-gray-500">@{{ user.username }}</div>
              </div>
            </div>
          </td>
          <td class="px-4 py-3">
            <span
              class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
              :class="getRoleBadgeClass(user.role)"
            >
              {{ getRoleLabel(user.role) }}
            </span>
          </td>
          <td class="px-4 py-3 text-gray-700 dark:text-gray-300">
            {{ user.department || '-' }}
          </td>
          <td class="px-4 py-3">
            <span
              class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium"
              :class="user.isActive
                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'"
            >
              <span class="w-1.5 h-1.5 rounded-full" :class="user.isActive ? 'bg-green-500' : 'bg-red-500'"></span>
              {{ user.isActive ? 'Active' : 'Inactive' }}
            </span>
          </td>
          <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
            {{ formatDate(user.lastLogin) }}
          </td>
          <td class="px-4 py-3">
            <div class="flex items-center justify-center gap-2">
              <button
                @click="emit('edit', user)"
                class="p-1.5 text-gray-500 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded transition-colors"
                title="Edit"
              >
                <AppIcon name="edit" size="4" />
              </button>
              <button
                @click="emit('delete', user)"
                class="p-1.5 text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                title="Delete"
              >
                <AppIcon name="trash" size="4" />
              </button>
            </div>
          </td>
        </tr>
        <tr v-if="users.length === 0">
          <td colspan="7" class="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
            <AppIcon name="users" size="8" class="mx-auto mb-2 opacity-50" />
            <p>No users found</p>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
