<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      @click.self="handleClose"
    >
      <div class="bg-white dark:bg-dark-card rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <!-- Header -->
        <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-dark-border">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <svg class="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            OS Version List
          </h3>
          <button
            @click="handleClose"
            class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Loading State -->
        <div v-if="loading" class="flex-1 flex items-center justify-center py-12">
          <div class="flex items-center gap-3 text-gray-600 dark:text-gray-400">
            <svg class="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Loading...</span>
          </div>
        </div>

        <!-- Content -->
        <div v-else class="flex-1 overflow-auto p-4">
          <!-- Toolbar -->
          <div class="flex items-center justify-between mb-4">
            <button
              @click="addNewRow"
              class="flex items-center gap-2 px-3 py-2 text-sm bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
              Add
            </button>
            <span class="text-sm text-gray-500 dark:text-gray-400">
              {{ items.length }} items
            </span>
          </div>

          <!-- Table -->
          <div class="border border-gray-200 dark:border-dark-border rounded-lg overflow-hidden">
            <table class="w-full">
              <thead class="bg-gray-50 dark:bg-dark-bg">
                <tr>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider w-1/3">
                    Version
                  </th>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider w-1/3">
                    Description
                  </th>
                  <th class="px-4 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider w-20">
                    Active
                  </th>
                  <th class="px-4 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider w-20">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200 dark:divide-dark-border">
                <tr
                  v-for="(item, index) in items"
                  :key="item._id || item._tempId"
                  :class="[
                    'transition-colors',
                    item._deleted ? 'bg-red-50 dark:bg-red-900/20 opacity-50 line-through' : '',
                    item._tempId ? 'bg-green-50 dark:bg-green-900/20' : '',
                    item._modified ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                  ]"
                >
                  <td class="px-4 py-2">
                    <input
                      v-model="item.version"
                      :disabled="item._deleted"
                      @input="markModified(item)"
                      class="w-full px-2 py-1.5 text-sm border rounded bg-white dark:bg-dark-bg border-gray-300 dark:border-dark-border focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      :class="{ 'border-red-500': errors[item._id || item._tempId]?.version }"
                      placeholder="e.g., Windows 10"
                    />
                    <p v-if="errors[item._id || item._tempId]?.version" class="mt-1 text-xs text-red-500">
                      {{ errors[item._id || item._tempId].version }}
                    </p>
                  </td>
                  <td class="px-4 py-2">
                    <input
                      v-model="item.description"
                      :disabled="item._deleted"
                      @input="markModified(item)"
                      class="w-full px-2 py-1.5 text-sm border rounded bg-white dark:bg-dark-bg border-gray-300 dark:border-dark-border focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      placeholder="Optional description"
                    />
                  </td>
                  <td class="px-4 py-2 text-center">
                    <input
                      type="checkbox"
                      v-model="item.active"
                      :disabled="item._deleted"
                      @change="markModified(item)"
                      class="w-4 h-4 text-blue-600 border-gray-300 dark:border-dark-border rounded focus:ring-blue-500 disabled:opacity-50"
                    />
                  </td>
                  <td class="px-4 py-2 text-center">
                    <button
                      v-if="!item._deleted"
                      @click="markForDeletion(item)"
                      class="p-1.5 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                      title="Delete"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                    <button
                      v-else
                      @click="undoDeletion(item)"
                      class="p-1.5 text-green-500 hover:bg-green-100 dark:hover:bg-green-900/30 rounded transition-colors"
                      title="Undo"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                      </svg>
                    </button>
                  </td>
                </tr>
                <tr v-if="items.length === 0">
                  <td colspan="4" class="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    No OS versions. Click "Add" to create one.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Footer -->
        <div class="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-dark-border">
          <div class="text-sm text-gray-500 dark:text-gray-400">
            <span v-if="hasChanges" class="text-amber-500">Unsaved changes</span>
          </div>
          <div class="flex gap-3">
            <button
              @click="handleClose"
              class="px-4 py-2 text-sm bg-gray-100 dark:bg-dark-border hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              @click="handleSave"
              :disabled="!hasChanges || saving"
              class="flex items-center gap-2 px-4 py-2 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg v-if="saving" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { osVersionApi } from '../api'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue', 'saved'])

// State
const loading = ref(false)
const saving = ref(false)
const items = ref([])
const originalItems = ref([])
const errors = ref({})

// Track changes
const hasChanges = computed(() => {
  // Check for new items
  if (items.value.some(item => item._tempId)) return true
  // Check for deleted items
  if (items.value.some(item => item._deleted)) return true
  // Check for modified items
  if (items.value.some(item => item._modified)) return true
  return false
})

// Load data when modal opens
watch(() => props.modelValue, async (newValue) => {
  if (newValue) {
    await loadData()
  }
})

async function loadData() {
  loading.value = true
  errors.value = {}
  try {
    const response = await osVersionApi.getAll()
    const data = response.data.data || []
    items.value = data.map(item => ({ ...item }))
    originalItems.value = JSON.parse(JSON.stringify(data))
  } catch (error) {
    console.error('Failed to load OS versions:', error)
  } finally {
    loading.value = false
  }
}

function addNewRow() {
  const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  items.value.unshift({
    _tempId: tempId,
    version: '',
    description: '',
    active: true
  })
}

function markModified(item) {
  if (item._id && !item._tempId) {
    item._modified = true
  }
}

function markForDeletion(item) {
  if (item._tempId && !item._id) {
    // Remove new item completely
    const index = items.value.findIndex(i => i._tempId === item._tempId)
    if (index !== -1) {
      items.value.splice(index, 1)
    }
  } else {
    item._deleted = true
  }
}

function undoDeletion(item) {
  item._deleted = false
}

function validate() {
  errors.value = {}
  let isValid = true

  for (const item of items.value) {
    if (item._deleted) continue

    const id = item._id || item._tempId
    const itemErrors = {}

    // Version is required
    if (!item.version || !item.version.trim()) {
      itemErrors.version = 'Version is required'
      isValid = false
    } else if (!/^[A-Za-z0-9.\- ]+$/.test(item.version)) {
      itemErrors.version = '영문, 숫자, 공백, ., - 만 허용'
      isValid = false
    } else {
      // Check for duplicates
      const duplicates = items.value.filter(i =>
        !i._deleted &&
        (i._id || i._tempId) !== id &&
        i.version?.toLowerCase() === item.version.toLowerCase()
      )
      if (duplicates.length > 0) {
        itemErrors.version = '중복된 버전'
        isValid = false
      }
    }

    if (Object.keys(itemErrors).length > 0) {
      errors.value[id] = itemErrors
    }
  }

  return isValid
}

async function handleSave() {
  if (!validate()) return

  saving.value = true
  try {
    // Collect items to create, update, and delete
    const toCreate = items.value.filter(item => item._tempId && !item._id && !item._deleted)
    const toUpdate = items.value.filter(item => item._id && item._modified && !item._deleted)
    const toDelete = items.value.filter(item => item._id && item._deleted)

    let created = 0
    let updated = 0
    let deleted = 0

    // Create new items
    if (toCreate.length > 0) {
      const createData = toCreate.map(({ _tempId, _modified, _deleted, ...data }) => data)
      const result = await osVersionApi.create(createData)
      if (result.data.errors?.length > 0) {
        // Map server errors
        for (const err of result.data.errors) {
          const item = toCreate[err.rowIndex]
          if (item) {
            const id = item._tempId
            if (!errors.value[id]) errors.value[id] = {}
            errors.value[id][err.field] = err.message
          }
        }
        if (result.data.created === 0) {
          saving.value = false
          return
        }
      }
      created = result.data.created || 0
    }

    // Update existing items
    if (toUpdate.length > 0) {
      const updateData = toUpdate.map(({ _tempId, _modified, _deleted, ...data }) => data)
      const result = await osVersionApi.update(updateData)
      if (result.data.errors?.length > 0) {
        for (const err of result.data.errors) {
          const item = toUpdate[err.rowIndex]
          if (item) {
            const id = item._id
            if (!errors.value[id]) errors.value[id] = {}
            errors.value[id][err.field] = err.message
          }
        }
      }
      updated = result.data.updated || 0
    }

    // Delete items
    if (toDelete.length > 0) {
      const ids = toDelete.map(item => item._id)
      const result = await osVersionApi.delete(ids)
      deleted = result.data.deleted || 0
    }

    // If any operation succeeded, reload and emit
    if (created > 0 || updated > 0 || deleted > 0) {
      await loadData()
      emit('saved')
    }
  } catch (error) {
    console.error('Failed to save OS versions:', error)
  } finally {
    saving.value = false
  }
}

function handleClose() {
  emit('update:modelValue', false)
}
</script>
