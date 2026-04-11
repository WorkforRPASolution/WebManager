<template>
  <div class="bg-white dark:bg-dark-card rounded-lg border border-gray-200 dark:border-dark-border">
    <!-- Header -->
    <div
      class="flex items-center justify-between px-4 py-3 cursor-pointer select-none hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors rounded-t-lg"
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
        <MultiSelect
          v-model="selectedProcesses"
          :options="processes"
          label="Process"
          placeholder="All Processes"
        />

        <!-- SE Auth Filter -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">SE Auth</label>
          <select
            v-model="selectedAuthority"
            class="px-3 py-2 rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 text-sm w-[150px] h-[38px]"
          >
            <option value="">All</option>
            <option value="WRITE">WRITE</option>
            <option value="NONE">None</option>
          </select>
        </div>

        <!-- Role Filter (Multi-select) -->
        <MultiSelect
          v-model="selectedRoles"
          :options="roleOptions"
          label="Role"
          placeholder="All Roles"
          width="170px"
        />

        <!-- Account Status Filter (Multi-select) -->
        <MultiSelect
          v-model="selectedAccountStatuses"
          :options="accountStatusOptions"
          label="Account"
          placeholder="All"
          width="170px"
        />

        <!-- Password Status Filter (Multi-select) -->
        <MultiSelect
          v-model="selectedPasswordStatuses"
          :options="passwordStatusOptions"
          label="Password"
          placeholder="All"
          width="180px"
        />

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
import { ref, computed, onMounted, onActivated } from 'vue'
import { usersApi } from '../api'
import { useProcessFilterStore } from '../../../shared/stores/processFilter'
import { useAuthStore } from '../../../shared/stores/auth'
import MultiSelect from '../../../shared/components/MultiSelect.vue'

defineProps({
  collapsed: { type: Boolean, default: false }
})

const emit = defineEmits(['filter-change', 'toggle'])

const processFilterStore = useProcessFilterStore()
const authStore = useAuthStore()

const processes = ref([])
const search = ref('')
const selectedProcesses = ref([])
const selectedAuthority = ref('')
const selectedRoles = ref([])
const selectedAccountStatuses = ref([])
const selectedPasswordStatuses = ref([])

const roleOptions = ['User (0)', 'Admin (1)', 'Conductor (2)', 'Manager (3)']
const accountStatusOptions = ['Active', 'Pending', 'Suspended']
const passwordStatusOptions = ['Normal', 'Reset Requested', 'Must Change']

const roleLabelToValue = { 'User (0)': '0', 'Admin (1)': '1', 'Conductor (2)': '2', 'Manager (3)': '3' }
const accountLabelToValue = { 'Active': 'active', 'Pending': 'pending', 'Suspended': 'suspended' }
const passwordLabelToValue = { 'Normal': 'normal', 'Reset Requested': 'reset_requested', 'Must Change': 'must_change' }

const filterSummary = computed(() => {
  const parts = []
  if (search.value) parts.push(`Search: "${search.value}"`)
  if (selectedProcesses.value.length > 0) {
    const processText = selectedProcesses.value.length === 1
      ? selectedProcesses.value[0]
      : `${selectedProcesses.value.length} processes`
    parts.push(`Process: ${processText}`)
  }
  if (selectedAuthority.value) parts.push(`SE Auth: ${selectedAuthority.value}`)
  if (selectedRoles.value.length > 0) parts.push(`Role: ${selectedRoles.value.join(', ')}`)
  if (selectedAccountStatuses.value.length > 0) parts.push(`Account: ${selectedAccountStatuses.value.join(', ')}`)
  if (selectedPasswordStatuses.value.length > 0) parts.push(`Password: ${selectedPasswordStatuses.value.join(', ')}`)
  return parts.length ? parts.join(', ') : 'No filters'
})

const fetchProcesses = async () => {
  try {
    // 관리자/MASTER가 아닌 경우 userProcesses 전달하여 서버에서 필터링
    const userProcesses = processFilterStore.canViewAllProcesses
      ? null
      : processFilterStore.getUserProcessList()

    const response = await usersApi.getProcesses(userProcesses)
    // Store에 캐시 (이미 서버에서 필터링됨)
    processFilterStore.setProcesses('users', response.data)
    processes.value = response.data
  } catch (error) {
    console.error('Failed to fetch processes:', error)
  }
}

const handleSearch = () => {
  // 관리자/MASTER가 아닌 경우 userProcesses 전달 (키워드 검색 시 process 권한 필터링용)
  const userProcesses = processFilterStore.canViewAllProcesses
    ? null
    : processFilterStore.getUserProcessList()

  const filters = {
    search: search.value,
    processes: selectedProcesses.value.length > 0 ? selectedProcesses.value : null,
    authority: selectedAuthority.value,
    authorityManager: selectedRoles.value.length > 0
      ? selectedRoles.value.map(r => roleLabelToValue[r]).join(',')
      : '',
    accountStatus: selectedAccountStatuses.value.length > 0
      ? selectedAccountStatuses.value.map(s => accountLabelToValue[s]).join(',')
      : '',
    passwordStatus: selectedPasswordStatuses.value.length > 0
      ? selectedPasswordStatuses.value.map(s => passwordLabelToValue[s]).join(',')
      : '',
    userProcesses
  }

  emit('filter-change', filters)
}

const handleClear = () => {
  search.value = ''
  selectedProcesses.value = []
  selectedAuthority.value = ''
  selectedRoles.value = []
  selectedAccountStatuses.value = []
  selectedPasswordStatuses.value = []
  emit('filter-change', null)
}

const refreshFilters = async () => {
  await fetchProcesses()
}

onMounted(async () => {
  await refreshFilters()
})

// keep-alive 재활성화 시 필터 옵션 갱신
onActivated(async () => {
  await refreshFilters()
})

defineExpose({ refreshFilters })
</script>
