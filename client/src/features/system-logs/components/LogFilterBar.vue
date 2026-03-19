<script setup>
import { ref } from 'vue'

const emit = defineEmits(['search'])

const category = ref('')
const startDate = ref('')
const endDate = ref('')
const userId = ref('')
const action = ref('')
const search = ref('')

const categories = [
  { value: '', label: 'All' },
  { value: 'audit', label: 'audit' },
  { value: 'error', label: 'error' },
  { value: 'auth', label: 'auth' },
  { value: 'batch', label: 'batch' }
]

function handleSearch() {
  emit('search', {
    category: category.value || undefined,
    startDate: startDate.value || undefined,
    endDate: endDate.value || undefined,
    userId: userId.value || undefined,
    action: action.value || undefined,
    search: search.value || undefined
  })
}

function handleReset() {
  category.value = ''
  startDate.value = ''
  endDate.value = ''
  userId.value = ''
  action.value = ''
  search.value = ''
  emit('search', {})
}
</script>

<template>
  <div class="flex flex-wrap items-end gap-3">
    <!-- Category -->
    <div>
      <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Category</label>
      <select
        v-model="category"
        class="px-3 py-2 text-sm border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
      >
        <option v-for="opt in categories" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
      </select>
    </div>

    <!-- Start Date -->
    <div>
      <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Start Date</label>
      <input
        v-model="startDate"
        type="date"
        class="px-3 py-2 text-sm border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
      />
    </div>

    <!-- End Date -->
    <div>
      <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">End Date</label>
      <input
        v-model="endDate"
        type="date"
        class="px-3 py-2 text-sm border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
      />
    </div>

    <!-- User ID -->
    <div>
      <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">User ID</label>
      <input
        v-model="userId"
        type="text"
        placeholder="User ID"
        class="px-3 py-2 text-sm border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
      />
    </div>

    <!-- Action -->
    <div>
      <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Action</label>
      <input
        v-model="action"
        type="text"
        placeholder="Action"
        class="px-3 py-2 text-sm border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
      />
    </div>

    <!-- Search -->
    <div>
      <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Search</label>
      <input
        v-model="search"
        type="text"
        placeholder="Free text search"
        class="px-3 py-2 text-sm border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
        @keyup.enter="handleSearch"
      />
    </div>

    <!-- Buttons -->
    <div class="flex items-end gap-2">
      <button
        @click="handleSearch"
        class="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium rounded-lg transition-colors"
      >
        Search
      </button>
      <button
        @click="handleReset"
        class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-dark-border hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
      >
        Reset
      </button>
    </div>
  </div>
</template>
