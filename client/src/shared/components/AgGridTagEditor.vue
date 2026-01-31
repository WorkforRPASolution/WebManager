<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import AppIcon from './AppIcon.vue'
import { getOptimalPopupPosition } from '../utils/agGridPopupPosition'

const props = defineProps({
  params: {
    type: Object,
    required: true
  }
})

// AG Grid editor interface
const tags = ref([])
const inputValue = ref('')
const containerRef = ref(null)
const inputRef = ref(null)

// Get placeholder from column params
const placeholder = computed(() => {
  return props.params.colDef?.cellEditorParams?.placeholder ||
         props.params.placeholder ||
         'Enter and press Enter...'
})

// Parse input value to tags (split by semicolon or comma)
const parseInput = (value) => {
  if (!value) return []
  return value.split(/[;,]/).map(s => s.trim()).filter(Boolean)
}

// Add tag from input
const addTag = () => {
  const value = inputValue.value.trim()
  if (!value) return

  // Check for multiple values (paste scenario)
  const newTags = parseInput(value)

  for (const tag of newTags) {
    if (tag && !tags.value.includes(tag)) {
      tags.value.push(tag)
    }
  }

  inputValue.value = ''
}

// Remove tag by index
const removeTag = (index) => {
  tags.value.splice(index, 1)
}

// Handle backspace when input is empty
const handleBackspace = () => {
  if (inputValue.value === '' && tags.value.length > 0) {
    tags.value.pop()
  }
}

// Handle paste event
const handlePaste = (event) => {
  event.preventDefault()
  const pastedText = event.clipboardData?.getData('text') || ''
  const newTags = parseInput(pastedText)

  for (const tag of newTags) {
    if (tag && !tags.value.includes(tag)) {
      tags.value.push(tag)
    }
  }
}

// Handle keyboard events
const handleKeyDown = (event) => {
  if (event.key === 'Enter') {
    event.preventDefault()
    event.stopPropagation() // Prevent AG Grid from closing the editor
    if (inputValue.value.trim()) {
      addTag()
    }
    // Empty input + Enter does nothing (use Done button or click outside to close)
  } else if (event.key === 'Tab') {
    event.preventDefault()
    if (inputValue.value.trim()) {
      addTag()
    } else {
      // Tab on empty input closes editor
      props.params.stopEditing()
    }
  } else if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    props.params.stopEditing(true) // Cancel
  } else if (event.key === 'Backspace') {
    handleBackspace()
  }
}

// Close editor and save
const handleDone = () => {
  props.params.stopEditing()
}

// AG Grid editor interface methods
defineExpose({
  getValue() {
    // Add any remaining input value before returning
    if (inputValue.value.trim()) {
      const remaining = parseInput(inputValue.value)
      for (const tag of remaining) {
        if (tag && !tags.value.includes(tag)) {
          tags.value.push(tag)
        }
      }
    }
    return [...tags.value]
  },
  isPopup() {
    return true
  },
  getPopupPosition() {
    return getOptimalPopupPosition(props.params, 150)
  }
})

onMounted(() => {
  // Initialize with current value
  const currentValue = props.params.value
  if (Array.isArray(currentValue)) {
    tags.value = [...currentValue]
  } else if (typeof currentValue === 'string' && currentValue) {
    // Handle semicolon-separated string (from valueGetter)
    tags.value = parseInput(currentValue)
  } else {
    tags.value = []
  }

  // Focus input
  nextTick(() => {
    inputRef.value?.focus()
  })
})
</script>

<template>
  <div
    ref="containerRef"
    class="ag-tag-editor bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-lg shadow-lg p-2"
  >
    <!-- Tags Container with Input -->
    <div class="flex flex-wrap items-center gap-1.5 min-h-[32px]">
      <!-- Existing Tags -->
      <div
        v-for="(tag, index) in tags"
        :key="index"
        class="inline-flex items-center gap-1 px-2 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-md text-sm"
      >
        <span class="max-w-[200px] truncate">{{ tag }}</span>
        <button
          @click="removeTag(index)"
          class="flex-shrink-0 w-4 h-4 flex items-center justify-center rounded hover:bg-primary-200 dark:hover:bg-primary-800/50 transition-colors"
          type="button"
        >
          <AppIcon name="x" size="3" />
        </button>
      </div>

      <!-- Input -->
      <input
        ref="inputRef"
        v-model="inputValue"
        @keydown="handleKeyDown"
        @paste="handlePaste"
        type="text"
        :placeholder="tags.length === 0 ? placeholder : ''"
        class="flex-1 min-w-[120px] px-1 py-1 text-sm bg-transparent border-none outline-none text-gray-900 dark:text-white placeholder-gray-400"
      />
    </div>

    <!-- Footer -->
    <div class="mt-2 pt-2 border-t border-gray-200 dark:border-dark-border flex items-center justify-between">
      <span class="text-xs text-gray-500 dark:text-gray-400">
        {{ tags.length }} tag{{ tags.length !== 1 ? 's' : '' }} · Enter to add
      </span>
      <button
        @click="handleDone"
        type="button"
        class="px-3 py-1 text-xs font-medium text-white bg-primary-500 hover:bg-primary-600 rounded transition-colors"
      >
        Done
      </button>
    </div>
  </div>
</template>

<style scoped>
.ag-tag-editor {
  min-width: 280px;
  max-width: 450px;
}
</style>
