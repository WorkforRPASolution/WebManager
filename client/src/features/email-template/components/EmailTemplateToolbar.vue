<template>
  <div class="flex items-center justify-between p-4 bg-white dark:bg-dark-card rounded-lg border border-gray-200 dark:border-dark-border">
    <!-- Left side - Action buttons -->
    <div class="flex items-center gap-3">
      <!-- Add Row with popover -->
      <div ref="addPopoverRef" class="relative">
        <button
          @click="showAddPopover = !showAddPopover"
          class="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-medium rounded-lg transition text-sm"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Add Row
        </button>

        <!-- Add Row Popover -->
        <div
          v-if="showAddPopover"
          class="absolute top-full left-0 mt-2 p-3 bg-white dark:bg-dark-card rounded-lg shadow-lg border border-gray-200 dark:border-dark-border z-50"
        >
          <div class="flex items-center gap-2">
            <label class="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">Rows:</label>
            <input
              v-model.number="rowCount"
              type="number"
              min="1"
              max="500"
              class="w-16 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-dark-bg text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-green-500"
              @keyup.enter="handleAdd"
              @input="enforceMaxRows"
            />
            <button
              @click="handleAdd"
              class="px-3 py-1 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded transition"
            >
              Add
            </button>
          </div>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Max 500 rows</p>
        </div>
      </div>

      <button
        @click="$emit('delete')"
        :disabled="selectedCount === 0"
        class="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg transition text-sm disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
        Delete ({{ selectedCount }})
      </button>

      <div class="h-6 w-px bg-gray-300 dark:bg-gray-600 mx-2"></div>

      <button
        @click="$emit('save')"
        :disabled="!hasChanges || saving"
        class="flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition text-sm disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <svg v-if="saving" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
        </svg>
        {{ saving ? 'Saving...' : 'Save Changes' }}
      </button>

      <button
        @click="$emit('discard')"
        :disabled="!hasChanges"
        class="flex items-center gap-2 px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg transition text-sm disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
        Discard
      </button>
    </div>

    <!-- Right side - Status info and Pagination -->
    <div class="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
      <span v-if="hasChanges" class="flex items-center gap-1 text-amber-600 dark:text-amber-400">
        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
        </svg>
        Unsaved changes
      </span>

      <!-- Total count -->
      <span>Total: {{ totalCount }} rows</span>

      <!-- Page size selector -->
      <div class="flex items-center gap-2">
        <span>Rows:</span>
        <select
          :value="pageSize"
          @change="$emit('page-size-change', Number($event.target.value))"
          class="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-dark-card text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-primary-500"
        >
          <option :value="10">10</option>
          <option :value="25">25</option>
          <option :value="50">50</option>
          <option :value="75">75</option>
          <option :value="100">100</option>
        </select>
      </div>

      <!-- Pagination controls -->
      <div v-if="totalPages > 1" class="flex items-center gap-2 ml-2 pl-2 border-l border-gray-300 dark:border-gray-600">
        <button
          @click="$emit('page-change', 1)"
          :disabled="currentPage === 1"
          class="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          title="First page"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>
        <button
          @click="$emit('page-change', currentPage - 1)"
          :disabled="currentPage === 1"
          class="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Previous page"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <span class="px-2">
          Page {{ currentPage }} of {{ totalPages }}
        </span>

        <button
          @click="$emit('page-change', currentPage + 1)"
          :disabled="currentPage === totalPages"
          class="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Next page"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>
        <button
          @click="$emit('page-change', totalPages)"
          :disabled="currentPage === totalPages"
          class="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Last page"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

defineProps({
  selectedCount: {
    type: Number,
    default: 0
  },
  hasChanges: {
    type: Boolean,
    default: false
  },
  saving: {
    type: Boolean,
    default: false
  },
  totalCount: {
    type: Number,
    default: 0
  },
  pageSize: {
    type: Number,
    default: 25
  },
  currentPage: {
    type: Number,
    default: 1
  },
  totalPages: {
    type: Number,
    default: 1
  }
})

const emit = defineEmits(['add', 'delete', 'save', 'discard', 'page-size-change', 'page-change'])

// Add Row popover state
const showAddPopover = ref(false)
const rowCount = ref(1)
const addPopoverRef = ref(null)

const enforceMaxRows = () => {
  if (rowCount.value > 500) {
    rowCount.value = 500
  } else if (rowCount.value < 1) {
    rowCount.value = 1
  }
}

const handleAdd = () => {
  const count = Math.max(1, Math.min(500, rowCount.value || 1))
  emit('add', count)
  showAddPopover.value = false
  rowCount.value = 1
}

const handleClickOutside = (event) => {
  if (showAddPopover.value && addPopoverRef.value && !addPopoverRef.value.contains(event.target)) {
    showAddPopover.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>
