<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { systemLogsApi } from '@/shared/api'

const emit = defineEmits(['search'])

const category = ref('')
const period = ref('today')
const startDate = ref('')
const endDate = ref('')
const userId = ref('')
const action = ref('')
const search = ref('')

// Filter options from API
const userIdOptions = ref([])
const actionOptions = ref([])

// Dropdown state
const userIdSearch = ref('')
const actionSearch = ref('')
const userIdDropdownOpen = ref(false)
const actionDropdownOpen = ref(false)
const userIdRef = ref(null)
const actionRef = ref(null)

const categories = [
  { value: '', label: 'All' },
  { value: 'audit', label: 'audit' },
  { value: 'error', label: 'error' },
  { value: 'auth', label: 'auth' },
  { value: 'batch', label: 'batch' },
  { value: 'access', label: 'access' },
  { value: 'eqp-redis', label: 'eqp-redis' }
]

const periods = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: '90d', label: '90d' },
  { value: 'custom', label: 'Custom' }
]

const isCustom = computed(() => period.value === 'custom')

const filteredUserIds = computed(() => {
  const q = userIdSearch.value.toLowerCase()
  if (!q) return userIdOptions.value
  return userIdOptions.value.filter(id => id.toLowerCase().includes(q))
})

const filteredActions = computed(() => {
  const q = actionSearch.value.toLowerCase()
  if (!q) return actionOptions.value
  return actionOptions.value.filter(a => a.toLowerCase().includes(q))
})

async function fetchFilterOptions() {
  try {
    const { data } = await systemLogsApi.getFilters()
    userIdOptions.value = data.userIds || []
    actionOptions.value = data.actions || []
  } catch {
    // silent — filters still work as text input
  }
}

function computeDateRange(p) {
  const now = new Date()
  const end = now.toISOString()
  const daysMap = { today: 0, '7d': 7, '30d': 30, '90d': 90 }
  const days = daysMap[p] ?? 0
  const start = new Date(now)
  start.setDate(start.getDate() - days)
  start.setHours(0, 0, 0, 0)
  return { startDate: start.toISOString(), endDate: end }
}

function handleSearch() {
  let dateFilter = {}
  if (isCustom.value) {
    if (startDate.value) dateFilter.startDate = new Date(startDate.value).toISOString()
    if (endDate.value) {
      const ed = new Date(endDate.value)
      ed.setHours(23, 59, 59, 999)
      dateFilter.endDate = ed.toISOString()
    }
  } else {
    dateFilter = computeDateRange(period.value)
  }

  emit('search', {
    category: category.value || undefined,
    ...dateFilter,
    userId: userId.value || undefined,
    action: action.value || undefined,
    search: search.value || undefined
  })
}

function selectPeriod(p) {
  period.value = p
  if (p !== 'custom') {
    startDate.value = ''
    endDate.value = ''
    handleSearch()
  }
}

function selectUserId(val) {
  userId.value = val
  userIdSearch.value = ''
  userIdDropdownOpen.value = false
}

function selectAction(val) {
  action.value = val
  actionSearch.value = ''
  actionDropdownOpen.value = false
}

function clearUserId() {
  userId.value = ''
  userIdSearch.value = ''
}

function clearAction() {
  action.value = ''
  actionSearch.value = ''
}

function handleReset() {
  category.value = ''
  period.value = 'today'
  startDate.value = ''
  endDate.value = ''
  userId.value = ''
  action.value = ''
  search.value = ''
  userIdSearch.value = ''
  actionSearch.value = ''
  emit('search', computeDateRange('today'))
}

// Click outside to close dropdowns
function handleClickOutside(e) {
  if (userIdRef.value && !userIdRef.value.contains(e.target)) {
    userIdDropdownOpen.value = false
  }
  if (actionRef.value && !actionRef.value.contains(e.target)) {
    actionDropdownOpen.value = false
  }
}

onMounted(() => {
  fetchFilterOptions()
  document.addEventListener('mousedown', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('mousedown', handleClickOutside)
})
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

    <!-- Period -->
    <div>
      <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Period</label>
      <div class="flex rounded-lg border border-gray-300 dark:border-dark-border overflow-hidden">
        <button
          v-for="p in periods"
          :key="p.value"
          @click="selectPeriod(p.value)"
          class="px-3 py-2 text-sm font-medium transition-colors border-r last:border-r-0 border-gray-300 dark:border-dark-border"
          :class="period === p.value
            ? 'bg-primary-500 text-white'
            : 'bg-white dark:bg-dark-bg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-border'"
        >
          {{ p.label }}
        </button>
      </div>
    </div>

    <!-- Custom Date Range -->
    <template v-if="isCustom">
      <div>
        <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Start Date</label>
        <input
          v-model="startDate"
          type="date"
          class="px-3 py-2 text-sm border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
        />
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">End Date</label>
        <input
          v-model="endDate"
          type="date"
          class="px-3 py-2 text-sm border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
        />
      </div>
    </template>

    <!-- User ID (searchable dropdown) -->
    <div ref="userIdRef" class="relative">
      <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">User ID</label>
      <div v-if="userId" class="flex items-center gap-1 px-3 py-2 text-sm border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg">
        <span class="text-gray-900 dark:text-white">{{ userId }}</span>
        <button @click="clearUserId" class="ml-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">&times;</button>
      </div>
      <div v-else>
        <input
          v-model="userIdSearch"
          type="text"
          placeholder="Select or type..."
          @focus="userIdDropdownOpen = true"
          @keyup.enter="userId = userIdSearch; userIdSearch = ''; userIdDropdownOpen = false"
          class="px-3 py-2 text-sm border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 w-40"
        />
      </div>
      <div
        v-if="userIdDropdownOpen && filteredUserIds.length > 0"
        class="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto bg-white dark:bg-dark-card rounded-lg border border-gray-200 dark:border-dark-border shadow-lg"
      >
        <button
          v-for="id in filteredUserIds"
          :key="id"
          @click="selectUserId(id)"
          class="block w-full text-left px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-border transition-colors"
        >
          {{ id }}
        </button>
      </div>
    </div>

    <!-- Action (searchable dropdown) -->
    <div ref="actionRef" class="relative">
      <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Action</label>
      <div v-if="action" class="flex items-center gap-1 px-3 py-2 text-sm border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg">
        <span class="text-gray-900 dark:text-white">{{ action }}</span>
        <button @click="clearAction" class="ml-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">&times;</button>
      </div>
      <div v-else>
        <input
          v-model="actionSearch"
          type="text"
          placeholder="Select or type..."
          @focus="actionDropdownOpen = true"
          @keyup.enter="action = actionSearch; actionSearch = ''; actionDropdownOpen = false"
          class="px-3 py-2 text-sm border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 w-44"
        />
      </div>
      <div
        v-if="actionDropdownOpen && filteredActions.length > 0"
        class="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto bg-white dark:bg-dark-card rounded-lg border border-gray-200 dark:border-dark-border shadow-lg"
      >
        <button
          v-for="act in filteredActions"
          :key="act"
          @click="selectAction(act)"
          class="block w-full text-left px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-border transition-colors"
        >
          {{ act }}
        </button>
      </div>
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
