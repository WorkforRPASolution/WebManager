<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import AppIcon from './AppIcon.vue'

const props = defineProps({
  params: {
    type: Object,
    required: true
  }
})

// AG Grid editor interface
const selectedValues = ref([])
const searchQuery = ref('')
const containerRef = ref(null)
const searchInputRef = ref(null)

// Get options from column params or cellEditorParams
const options = computed(() => {
  return props.params.colDef?.cellEditorParams?.options ||
         props.params.options ||
         []
})

// Check if allowCustomInput is enabled
// Note: cellEditorParams can be a function, so AG Grid passes the result directly to props.params
const allowCustomInput = computed(() => {
  return props.params.colDef?.cellEditorParams?.allowCustomInput ||
         props.params.allowCustomInput ||
         false
})

// Normalize input for custom values (uppercase + underscore only)
const normalizeInput = (value) => {
  return value.toUpperCase().replace(/[^A-Z_]/g, '')
}

// Handle search input with optional normalization
const handleSearchInput = (event) => {
  if (allowCustomInput.value) {
    searchQuery.value = normalizeInput(event.target.value)
  } else {
    searchQuery.value = event.target.value
  }
}

// Filtered options based on search query
const filteredOptions = computed(() => {
  if (!searchQuery.value) return options.value
  const query = searchQuery.value.toLowerCase()
  return options.value.filter(opt => opt.toLowerCase().includes(query))
})

// Check if current search query can be added as new value
const canAddNewValue = computed(() => {
  if (!allowCustomInput.value || !searchQuery.value) return false
  const normalized = normalizeInput(searchQuery.value)
  return normalized && !selectedValues.value.includes(normalized) && !options.value.includes(normalized)
})

// Add new custom value
const addNewValue = () => {
  const normalized = normalizeInput(searchQuery.value)
  if (normalized && !selectedValues.value.includes(normalized)) {
    selectedValues.value.push(normalized)
  }
  searchQuery.value = ''
}

// Check if all filtered options are selected
const allSelected = computed(() => {
  if (filteredOptions.value.length === 0) return false
  return filteredOptions.value.every(opt => selectedValues.value.includes(opt))
})

// Check if some (but not all) are selected
const someSelected = computed(() => {
  if (filteredOptions.value.length === 0) return false
  const selectedCount = filteredOptions.value.filter(opt => selectedValues.value.includes(opt)).length
  return selectedCount > 0 && selectedCount < filteredOptions.value.length
})

function toggleOption(option) {
  const index = selectedValues.value.indexOf(option)
  if (index === -1) {
    selectedValues.value.push(option)
  } else {
    selectedValues.value.splice(index, 1)
  }
}

function toggleAll() {
  if (allSelected.value) {
    // Deselect all filtered options
    selectedValues.value = selectedValues.value.filter(v => !filteredOptions.value.includes(v))
  } else {
    // Select all filtered options
    selectedValues.value = [...new Set([...selectedValues.value, ...filteredOptions.value])]
  }
}

function handleKeyDown(event) {
  // Enter: add new value if allowed or confirm and close
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    if (allowCustomInput.value && searchQuery.value) {
      addNewValue()
    } else {
      props.params.stopEditing()
    }
  }
  // Escape: cancel
  if (event.key === 'Escape') {
    event.preventDefault()
    props.params.stopEditing(true)
  }
}

// AG Grid editor interface methods
defineExpose({
  getValue() {
    // Return array directly (valueSetter will handle conversion if needed)
    return selectedValues.value
  },
  isPopup() {
    return true
  },
  getPopupPosition() {
    return 'under'
  }
})

onMounted(() => {
  // Initialize with current value
  const currentValue = props.params.value
  if (Array.isArray(currentValue)) {
    selectedValues.value = [...currentValue]
  } else if (typeof currentValue === 'string' && currentValue) {
    // Handle semicolon-separated string (from valueGetter)
    selectedValues.value = currentValue.split(';').map(s => s.trim()).filter(Boolean)
  } else {
    selectedValues.value = []
  }

  // Focus search input
  nextTick(() => {
    searchInputRef.value?.focus()
  })
})
</script>

<template>
  <div
    ref="containerRef"
    class="ag-multi-select-editor bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-lg shadow-lg"
    @keydown="handleKeyDown"
  >
    <!-- Search Input -->
    <div class="p-2 border-b border-gray-200 dark:border-dark-border">
      <div class="relative">
        <AppIcon
          name="search"
          size="4"
          class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        />
        <input
          ref="searchInputRef"
          :value="searchQuery"
          @input="handleSearchInput"
          type="text"
          :placeholder="allowCustomInput ? 'Search or add (A-Z, _ only)...' : 'Search...'"
          class="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-gray-900 dark:text-white placeholder-gray-400"
        />
      </div>
    </div>

    <!-- Options List -->
    <div class="max-h-48 overflow-y-auto">
      <!-- Select All -->
      <div
        v-if="filteredOptions.length > 0"
        @click="toggleAll"
        class="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-dark-border cursor-pointer border-b border-gray-100 dark:border-dark-border"
      >
        <div
          class="w-4 h-4 rounded border flex items-center justify-center transition-colors"
          :class="[
            allSelected
              ? 'bg-primary-500 border-primary-500'
              : someSelected
                ? 'bg-primary-200 border-primary-400'
                : 'border-gray-300 dark:border-gray-600'
          ]"
        >
          <AppIcon v-if="allSelected" name="check" size="3" class="text-white" />
          <div v-else-if="someSelected" class="w-2 h-0.5 bg-primary-500 rounded"></div>
        </div>
        <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Select All</span>
      </div>

      <!-- Options -->
      <div
        v-for="option in filteredOptions"
        :key="option"
        @click="toggleOption(option)"
        class="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-dark-border cursor-pointer"
      >
        <div
          class="w-4 h-4 rounded border flex items-center justify-center transition-colors"
          :class="selectedValues.includes(option)
            ? 'bg-primary-500 border-primary-500'
            : 'border-gray-300 dark:border-gray-600'"
        >
          <AppIcon v-if="selectedValues.includes(option)" name="check" size="3" class="text-white" />
        </div>
        <span class="text-sm text-gray-700 dark:text-gray-300">{{ option }}</span>
      </div>

      <!-- No Results / Add Custom Value -->
      <div v-if="filteredOptions.length === 0" class="px-3 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
        <template v-if="canAddNewValue">
          Press Enter to add "<span class="font-medium text-primary-500">{{ normalizeInput(searchQuery) }}</span>"
        </template>
        <template v-else>
          No options found
        </template>
      </div>
    </div>

    <!-- Footer: Selected count & hint -->
    <div class="px-3 py-2 border-t border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg rounded-b-lg">
      <div class="flex items-center justify-between">
        <span class="text-xs text-gray-500 dark:text-gray-400">
          {{ selectedValues.length }} selected
        </span>
        <span class="text-xs text-gray-400 dark:text-gray-500">
          Enter to confirm
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ag-multi-select-editor {
  min-width: 200px;
  max-width: 280px;
}
</style>
