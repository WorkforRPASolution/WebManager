<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'

const props = defineProps({
  params: {
    type: Object,
    required: true
  }
})

// State
const selectedValue = ref('')
const searchQuery = ref('')
const containerRef = ref(null)
const searchInputRef = ref(null)

// Available options
const availableOptions = ref([])
const loadingOptions = ref(false)

// Get editor params
const editorParams = computed(() => {
  return props.params.colDef?.cellEditorParams || {}
})

// Filtered options based on search query
const filteredOptions = computed(() => {
  if (!searchQuery.value) return availableOptions.value
  const query = searchQuery.value.toLowerCase()
  return availableOptions.value.filter(opt => opt.toLowerCase().includes(query))
})

// Check if current search can be added as custom value
const canAddCustomValue = computed(() => {
  if (!searchQuery.value) return false
  const value = searchQuery.value.trim().toUpperCase()
  return value && !availableOptions.value.some(opt => opt.toUpperCase() === value)
})

// Fetch options
const fetchOptions = async () => {
  loadingOptions.value = true
  try {
    let params = editorParams.value
    if (typeof params === 'function') {
      params = params(props.params)
    }

    // If options are directly provided
    if (params.options && Array.isArray(params.options)) {
      availableOptions.value = params.options
      return
    }

    // If fetchOptions function is provided
    if (params.fetchOptions && typeof params.fetchOptions === 'function') {
      const options = await params.fetchOptions()
      availableOptions.value = options || []
      return
    }

    availableOptions.value = []
  } catch (error) {
    console.error('Failed to fetch options:', error)
    availableOptions.value = []
  } finally {
    loadingOptions.value = false
  }
}

// Select an option
const selectOption = (option) => {
  selectedValue.value = option
  // Auto-close after selection
  props.params.stopEditing()
}

// Add custom value from search
const addCustomValue = () => {
  if (searchQuery.value.trim()) {
    selectedValue.value = searchQuery.value.trim().toUpperCase()
    props.params.stopEditing()
  }
}

// Handle keyboard events
const handleKeyDown = (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    if (canAddCustomValue.value) {
      addCustomValue()
    } else {
      props.params.stopEditing()
    }
  }
  if (event.key === 'Escape') {
    event.preventDefault()
    props.params.stopEditing(true)
  }
}

// AG Grid editor interface methods
defineExpose({
  getValue() {
    return selectedValue.value
  },
  isPopup() {
    return true
  },
  getPopupPosition() {
    return 'under'
  }
})

onMounted(async () => {
  // Set current value
  const currentValue = props.params.value || ''
  selectedValue.value = currentValue

  // Fetch options
  await fetchOptions()

  // Focus search input
  nextTick(() => {
    searchInputRef.value?.focus()
  })
})
</script>

<template>
  <div
    ref="containerRef"
    class="ag-process-model-editor bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-lg shadow-lg"
    @keydown="handleKeyDown"
  >
    <!-- Search Input -->
    <div class="p-2">
      <div class="relative">
        <svg class="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          ref="searchInputRef"
          v-model="searchQuery"
          type="text"
          placeholder="Search or add (A-Z, _ or ...)"
          class="w-full pl-8 pr-3 py-1.5 text-sm bg-white dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 text-gray-900 dark:text-white placeholder-gray-400"
        />
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loadingOptions" class="px-3 py-4 text-center">
      <div class="flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400">
        <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span>Loading...</span>
      </div>
    </div>

    <!-- Options List -->
    <div v-else class="max-h-48 overflow-y-auto">
      <!-- Options -->
      <div
        v-for="option in filteredOptions"
        :key="option"
        @click="selectOption(option)"
        class="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-dark-border cursor-pointer"
      >
        <div
          class="w-4 h-4 rounded border flex items-center justify-center transition-colors"
          :class="selectedValue === option
            ? 'bg-primary-500 border-primary-500'
            : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-bg'"
        >
          <svg v-if="selectedValue === option" class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <span class="text-sm text-gray-700 dark:text-gray-300">{{ option }}</span>
      </div>

      <!-- No Results / Add Custom Value -->
      <div v-if="filteredOptions.length === 0" class="px-3 py-3 text-center text-sm text-gray-500 dark:text-gray-400">
        <template v-if="canAddCustomValue">
          Press Enter to add "<span class="font-medium text-primary-500">{{ searchQuery.toUpperCase() }}</span>"
        </template>
        <template v-else>
          No options found
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ag-process-model-editor {
  min-width: 200px;
  max-width: 260px;
}
</style>
