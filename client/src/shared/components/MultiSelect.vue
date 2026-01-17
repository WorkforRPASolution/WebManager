<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import AppIcon from './AppIcon.vue'

const props = defineProps({
  options: {
    type: Array,
    default: () => []
  },
  modelValue: {
    type: Array,
    default: () => []
  },
  placeholder: {
    type: String,
    default: 'Select...'
  },
  label: {
    type: String,
    default: ''
  },
  disabled: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue'])

const isOpen = ref(false)
const searchQuery = ref('')
const containerRef = ref(null)

// Filtered options based on search query (case-insensitive)
const filteredOptions = computed(() => {
  if (!searchQuery.value) return props.options
  const query = searchQuery.value.toLowerCase()
  return props.options.filter(opt => opt.toLowerCase().includes(query))
})

// Check if all filtered options are selected
const allSelected = computed(() => {
  if (filteredOptions.value.length === 0) return false
  return filteredOptions.value.every(opt => props.modelValue.includes(opt))
})

// Check if some (but not all) are selected
const someSelected = computed(() => {
  if (filteredOptions.value.length === 0) return false
  const selectedCount = filteredOptions.value.filter(opt => props.modelValue.includes(opt)).length
  return selectedCount > 0 && selectedCount < filteredOptions.value.length
})

// Display text for the input field
const displayText = computed(() => {
  if (props.modelValue.length === 0) return ''
  if (props.modelValue.length === props.options.length) return 'All selected'
  return `${props.modelValue.length} selected`
})

function toggleDropdown() {
  if (props.disabled) return
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    searchQuery.value = ''
  }
}

function toggleOption(option) {
  const newValue = [...props.modelValue]
  const index = newValue.indexOf(option)
  if (index === -1) {
    newValue.push(option)
  } else {
    newValue.splice(index, 1)
  }
  emit('update:modelValue', newValue)
}

function toggleAll() {
  if (allSelected.value) {
    // Deselect all filtered options
    const newValue = props.modelValue.filter(v => !filteredOptions.value.includes(v))
    emit('update:modelValue', newValue)
  } else {
    // Select all filtered options
    const newValue = [...new Set([...props.modelValue, ...filteredOptions.value])]
    emit('update:modelValue', newValue)
  }
}

function removeItem(option) {
  const newValue = props.modelValue.filter(v => v !== option)
  emit('update:modelValue', newValue)
}

function handleClickOutside(event) {
  if (containerRef.value && !containerRef.value.contains(event.target)) {
    isOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <div ref="containerRef" class="relative">
    <!-- Label -->
    <label v-if="label" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
      {{ label }}
    </label>

    <!-- Input Field -->
    <div
      @click="toggleDropdown"
      class="flex items-center justify-between px-3 py-2 rounded-lg border cursor-pointer transition-colors min-w-[180px]"
      :class="[
        disabled
          ? 'bg-gray-100 dark:bg-dark-border cursor-not-allowed opacity-50'
          : 'bg-white dark:bg-dark-bg hover:border-primary-400',
        isOpen
          ? 'border-primary-500 ring-2 ring-primary-500/20'
          : 'border-gray-300 dark:border-dark-border'
      ]"
    >
      <span
        class="text-sm truncate"
        :class="modelValue.length > 0 ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'"
      >
        {{ displayText || placeholder }}
      </span>
      <AppIcon
        name="chevron_down"
        size="4"
        class="text-gray-400 transition-transform"
        :class="{ 'rotate-180': isOpen }"
      />
    </div>

    <!-- Dropdown -->
    <div
      v-show="isOpen"
      class="absolute z-50 mt-1 w-full bg-white dark:bg-dark-card rounded-lg border border-gray-200 dark:border-dark-border shadow-lg"
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
            v-model="searchQuery"
            type="text"
            placeholder="Search..."
            class="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-gray-900 dark:text-white placeholder-gray-400"
            @click.stop
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
            :class="modelValue.includes(option)
              ? 'bg-primary-500 border-primary-500'
              : 'border-gray-300 dark:border-gray-600'"
          >
            <AppIcon v-if="modelValue.includes(option)" name="check" size="3" class="text-white" />
          </div>
          <span class="text-sm text-gray-700 dark:text-gray-300">{{ option }}</span>
        </div>

        <!-- No Results -->
        <div v-if="filteredOptions.length === 0" class="px-3 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
          No options found
        </div>
      </div>
    </div>

    <!-- Selected Items Chips -->
    <div v-if="modelValue.length > 0" class="flex flex-wrap gap-1 mt-2">
      <span
        v-for="item in modelValue"
        :key="item"
        class="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full"
      >
        {{ item }}
        <button
          @click.stop="removeItem(item)"
          class="hover:text-primary-900 dark:hover:text-primary-100"
        >
          <AppIcon name="x" size="3" />
        </button>
      </span>
    </div>
  </div>
</template>
