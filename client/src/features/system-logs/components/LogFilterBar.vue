<script setup>
import { ref, computed, onMounted } from 'vue'
import { systemLogsApi } from '@/shared/api'
import MultiSelect from '@/shared/components/MultiSelect.vue'

const emit = defineEmits(['search'])

const category = ref('')
const period = ref('today')
const startDate = ref('')
const endDate = ref('')
const selectedUserIds = ref([])
const selectedActions = ref([])
const search = ref('')

// Filter options from API
const userIdOptions = ref([])
const actionOptions = ref([])

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
    userId: selectedUserIds.value.length > 0 ? selectedUserIds.value.join(',') : undefined,
    action: selectedActions.value.length > 0 ? selectedActions.value.join(',') : undefined,
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

function handleReset() {
  category.value = ''
  period.value = 'today'
  startDate.value = ''
  endDate.value = ''
  selectedUserIds.value = []
  selectedActions.value = []
  search.value = ''
  emit('search', computeDateRange('today'))
}

onMounted(() => {
  fetchFilterOptions()
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

    <!-- User ID (MultiSelect) -->
    <MultiSelect
      v-model="selectedUserIds"
      :options="userIdOptions"
      label="User ID"
      placeholder="All Users"
      width="180px"
    />

    <!-- Action (MultiSelect) -->
    <MultiSelect
      v-model="selectedActions"
      :options="actionOptions"
      label="Action"
      placeholder="All Actions"
      width="180px"
    />

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
