<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
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
  },
  width: {
    type: String,
    default: '180px'
  }
})

const emit = defineEmits(['update:modelValue'])

const isOpen = ref(false)
const searchQuery = ref('')
const searchInputRef = ref(null)
const containerRef = ref(null)

// Helpers: support both string[] and [{value, count}] options
const getOptionValue = (opt) => typeof opt === 'string' ? opt : opt.value
const getOptionCount = (opt) => (typeof opt === 'object' && opt !== null && opt.count != null) ? opt.count : null

// Filtered options based on search query (case-insensitive)
const filteredOptions = computed(() => {
  if (!searchQuery.value) return props.options
  const query = searchQuery.value.toLowerCase()
  return props.options.filter(opt => getOptionValue(opt).toLowerCase().includes(query))
})

// Check if all filtered options are selected
const allSelected = computed(() => {
  if (filteredOptions.value.length === 0) return false
  return filteredOptions.value.every(opt => props.modelValue.includes(getOptionValue(opt)))
})

// Check if some (but not all) are selected
const someSelected = computed(() => {
  if (filteredOptions.value.length === 0) return false
  const selectedCount = filteredOptions.value.filter(opt => props.modelValue.includes(getOptionValue(opt))).length
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
    nextTick(() => searchInputRef.value?.focus())
  }
}

function toggleOption(option) {
  const value = getOptionValue(option)
  const newValue = [...props.modelValue]
  const index = newValue.indexOf(value)
  if (index === -1) {
    newValue.push(value)
  } else {
    newValue.splice(index, 1)
  }
  emit('update:modelValue', newValue)
}

function toggleAll() {
  const filteredValues = filteredOptions.value.map(getOptionValue)
  if (allSelected.value) {
    // Deselect all filtered options
    const newValue = props.modelValue.filter(v => !filteredValues.includes(v))
    emit('update:modelValue', newValue)
  } else {
    // Select all filtered options
    const newValue = [...new Set([...props.modelValue, ...filteredValues])]
    emit('update:modelValue', newValue)
  }
}

function removeItem(option) {
  const value = getOptionValue(option)
  const newValue = props.modelValue.filter(v => v !== value)
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
      class="flex items-center justify-between px-3 py-2 rounded-lg border cursor-pointer transition-colors"
      :style="{ width: width }"
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
            ref="searchInputRef"
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
          :key="getOptionValue(option)"
          @click="toggleOption(option)"
          class="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-dark-border cursor-pointer"
        >
          <div
            class="w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0"
            :class="modelValue.includes(getOptionValue(option))
              ? 'bg-primary-500 border-primary-500'
              : 'border-gray-300 dark:border-gray-600'"
          >
            <AppIcon v-if="modelValue.includes(getOptionValue(option))" name="check" size="3" class="text-white" />
          </div>
          <span class="text-sm text-gray-700 dark:text-gray-300 flex-1 truncate" :title="getOptionValue(option)">{{ getOptionValue(option) }}</span>
          <span
            v-if="getOptionCount(option) != null"
            class="text-xs text-gray-400 dark:text-gray-500 tabular-nums whitespace-nowrap"
          >({{ getOptionCount(option) }})</span>
        </div>

        <!-- No Results -->
        <div v-if="filteredOptions.length === 0" class="px-3 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
          No options found
        </div>
      </div>
    </div>
  </div>
</template>
