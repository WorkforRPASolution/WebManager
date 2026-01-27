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

        <!-- Process Filter (Multi-select) -->
        <div class="relative" ref="processDropdownRef">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Process</label>
          <button
            type="button"
            @click="toggleProcessDropdown"
            class="px-3 py-2 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 text-sm w-[200px] text-left flex items-center justify-between"
          >
            <span class="truncate">
              {{ selectedProcesses.length === 0 ? 'All Processes' : selectedProcesses.length === 1 ? selectedProcesses[0] : `${selectedProcesses.length} selected` }}
            </span>
            <svg class="w-4 h-4 ml-2 flex-shrink-0" :class="{ 'rotate-180': showProcessDropdown }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <!-- Dropdown Menu -->
          <div
            v-show="showProcessDropdown"
            class="absolute z-50 mt-1 w-[200px] max-h-60 overflow-auto bg-white dark:bg-dark-card border border-gray-300 dark:border-dark-border rounded-lg shadow-lg"
          >
            <div class="p-2 border-b border-gray-200 dark:border-dark-border">
              <label class="flex items-center gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-dark-hover p-1 rounded">
                <input
                  type="checkbox"
                  :checked="selectedProcesses.length === 0"
                  @change="clearProcessSelection"
                  class="rounded border-gray-300 dark:border-dark-border text-primary-500 focus:ring-primary-500"
                />
                <span class="text-sm text-gray-700 dark:text-gray-300">All Processes</span>
              </label>
            </div>
            <div class="p-2">
              <label
                v-for="p in processes"
                :key="p"
                class="flex items-center gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-dark-hover p-1 rounded"
              >
                <input
                  type="checkbox"
                  :value="p"
                  v-model="selectedProcesses"
                  class="rounded border-gray-300 dark:border-dark-border text-primary-500 focus:ring-primary-500"
                />
                <span class="text-sm text-gray-700 dark:text-gray-300">{{ p }}</span>
              </label>
            </div>
          </div>
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

        <!-- Account Status Filter -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Account</label>
          <select
            v-model="selectedAccountStatus"
            class="px-3 py-2 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 text-sm w-[150px]"
          >
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>

        <!-- Password Status Filter -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
          <select
            v-model="selectedPasswordStatus"
            class="px-3 py-2 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 text-sm w-[160px]"
          >
            <option value="">All</option>
            <option value="normal">Normal</option>
            <option value="reset_requested">Reset Requested</option>
            <option value="must_change">Must Change</option>
          </select>
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
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { usersApi } from '../api'
import { useProcessFilterStore } from '../../../shared/stores/processFilter'

defineProps({
  collapsed: { type: Boolean, default: false }
})

const emit = defineEmits(['filter-change', 'toggle'])

const processFilterStore = useProcessFilterStore()

const processes = ref([])
const lines = ref([])
const search = ref('')
const selectedProcesses = ref([])  // Changed to array for multi-select
const showProcessDropdown = ref(false)
const processDropdownRef = ref(null)
const selectedLine = ref('')
const selectedRole = ref('')
const selectedAccountStatus = ref('')
const selectedPasswordStatus = ref('')

// Toggle dropdown
const toggleProcessDropdown = () => {
  showProcessDropdown.value = !showProcessDropdown.value
}

// Clear process selection (select "All")
const clearProcessSelection = () => {
  selectedProcesses.value = []
}

// Close dropdown when clicking outside
const handleClickOutside = (event) => {
  if (processDropdownRef.value && !processDropdownRef.value.contains(event.target)) {
    showProcessDropdown.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})

// Watch for process selection changes to refresh lines
watch(selectedProcesses, async () => {
  // Refresh lines when processes change
  if (selectedProcesses.value.length === 1) {
    await fetchLines(selectedProcesses.value[0])
  } else {
    await fetchLines()
  }
})

const accountStatusLabels = {
  active: 'Active',
  pending: 'Pending',
  suspended: 'Suspended'
}

const passwordStatusLabels = {
  normal: 'Normal',
  reset_requested: 'Reset Requested',
  must_change: 'Must Change'
}

const filterSummary = computed(() => {
  const parts = []
  if (search.value) parts.push(`Search: "${search.value}"`)
  if (selectedProcesses.value.length > 0) {
    const processText = selectedProcesses.value.length === 1
      ? selectedProcesses.value[0]
      : `${selectedProcesses.value.length} processes`
    parts.push(`Process: ${processText}`)
  }
  if (selectedLine.value) parts.push(`Line: ${selectedLine.value}`)
  if (selectedRole.value) parts.push(`Role: ${selectedRole.value}`)
  if (selectedAccountStatus.value) parts.push(`Account: ${accountStatusLabels[selectedAccountStatus.value]}`)
  if (selectedPasswordStatus.value) parts.push(`Password: ${passwordStatusLabels[selectedPasswordStatus.value]}`)
  return parts.length ? parts.join(', ') : 'No filters'
})

const fetchProcesses = async () => {
  try {
    const response = await usersApi.getProcesses()
    // Users uses ARS_USER_INFO data source
    processFilterStore.setProcesses('users', response.data)
    processes.value = processFilterStore.getFilteredProcesses('users')
  } catch (error) {
    console.error('Failed to fetch processes:', error)
  }
}

const fetchLines = async (process = null) => {
  try {
    const response = await usersApi.getLines(process)
    lines.value = response.data
  } catch (error) {
    console.error('Failed to fetch lines:', error)
  }
}

const handleSearch = () => {
  const filters = {
    search: search.value,
    processes: selectedProcesses.value.length > 0 ? selectedProcesses.value : null,  // Use array for multi-process
    line: selectedLine.value,
    authorityManager: selectedRole.value,
    accountStatus: selectedAccountStatus.value,
    passwordStatus: selectedPasswordStatus.value
  }

  emit('filter-change', filters)
}

const handleClear = () => {
  search.value = ''
  selectedProcesses.value = []
  showProcessDropdown.value = false
  selectedLine.value = ''
  selectedRole.value = ''
  selectedAccountStatus.value = ''
  selectedPasswordStatus.value = ''
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
