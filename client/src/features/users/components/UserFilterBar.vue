<template>
  <div class="bg-white dark:bg-dark-card rounded-lg border border-gray-200 dark:border-dark-border">
    <!-- Header -->
    <div
      class="flex items-center justify-between px-4 py-3 cursor-pointer select-none hover:bg-gray-50 dark:hover:bg-dark-hover transition-colors rounded-t-lg"
      @click="$emit('toggle')"
    >
      <div class="flex items-center gap-2">
        <svg
          :class="['w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform duration-200', collapsed ? '-rotate-90' : '']"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
        <span class="font-medium text-gray-700 dark:text-gray-300">Filters</span>
        <span v-if="collapsed" class="text-sm text-gray-500 dark:text-gray-400 ml-2">
          {{ filterSummary }}
        </span>
      </div>
    </div>

    <!-- Filter Content -->
    <div v-show="!collapsed" class="transition-all duration-200 ease-out">
      <div class="flex flex-wrap items-end gap-4 px-4 pb-4 pt-1">
        <!-- Search -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Search</label>
          <input
            v-model="search"
            type="text"
            placeholder="Name, ID, Email..."
            class="px-3 py-2 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm w-[200px]"
            @keyup.enter="handleSearch"
          />
        </div>

        <!-- Process Filter -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Process</label>
          <select
            v-model="selectedProcess"
            class="px-3 py-2 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 text-sm w-[150px]"
          >
            <option value="">All Processes</option>
            <option v-for="p in processes" :key="p" :value="p">{{ p }}</option>
          </select>
        </div>

        <!-- Line Filter -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Line</label>
          <select
            v-model="selectedLine"
            class="px-3 py-2 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 text-sm w-[150px]"
          >
            <option value="">All Lines</option>
            <option v-for="l in lines" :key="l" :value="l">{{ l }}</option>
          </select>
        </div>

        <!-- Role Filter -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Role</label>
          <select
            v-model="selectedRole"
            class="px-3 py-2 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 text-sm w-[150px]"
          >
            <option value="">All Roles</option>
            <option value="0">User (0)</option>
            <option value="1">Admin (1)</option>
            <option value="2">Conductor (2)</option>
            <option value="3">Manager (3)</option>
          </select>
        </div>

        <!-- Active Only -->
        <div class="flex items-center gap-2 h-[38px]">
          <input
            v-model="activeOnly"
            type="checkbox"
            id="activeOnly"
            class="w-4 h-4 rounded border-gray-300 text-primary-500 focus:ring-primary-500"
          />
          <label for="activeOnly" class="text-sm text-gray-700 dark:text-gray-300">Active Only</label>
        </div>

        <!-- Search Button -->
        <button
          @click="handleSearch"
          class="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition text-sm h-[38px]"
        >
          Search
        </button>

        <!-- Clear Button -->
        <button
          @click="handleClear"
          class="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg transition text-sm h-[38px]"
        >
          Clear
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { usersApi } from '../api'

defineProps({
  collapsed: { type: Boolean, default: false }
})

const emit = defineEmits(['filter-change', 'toggle'])

const processes = ref([])
const lines = ref([])
const search = ref('')
const selectedProcess = ref('')
const selectedLine = ref('')
const selectedRole = ref('')
const activeOnly = ref(false)

const filterSummary = computed(() => {
  const parts = []
  if (search.value) parts.push(`Search: "${search.value}"`)
  if (selectedProcess.value) parts.push(`Process: ${selectedProcess.value}`)
  if (selectedLine.value) parts.push(`Line: ${selectedLine.value}`)
  if (selectedRole.value) parts.push(`Role: ${selectedRole.value}`)
  if (activeOnly.value) parts.push('Active Only')
  return parts.length ? parts.join(', ') : 'No filters'
})

const fetchProcesses = async () => {
  try {
    const response = await usersApi.getProcesses()
    processes.value = response.data
  } catch (error) {
    console.error('Failed to fetch processes:', error)
  }
}

const fetchLines = async () => {
  try {
    const response = await usersApi.getLines(selectedProcess.value)
    lines.value = response.data
  } catch (error) {
    console.error('Failed to fetch lines:', error)
  }
}

const handleSearch = () => {
  emit('filter-change', {
    search: search.value,
    process: selectedProcess.value,
    line: selectedLine.value,
    authorityManager: selectedRole.value,
    isActive: activeOnly.value ? 'true' : undefined
  })
}

const handleClear = () => {
  search.value = ''
  selectedProcess.value = ''
  selectedLine.value = ''
  selectedRole.value = ''
  activeOnly.value = false
  emit('filter-change', null)
}

const refreshFilters = async () => {
  await Promise.all([fetchProcesses(), fetchLines()])
}

onMounted(async () => {
  await refreshFilters()
})

defineExpose({ refreshFilters })
</script>
