<script setup>
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { getOptimalPopupPosition } from '../utils/agGridPopupPosition'

const props = defineProps({
  params: {
    type: Object,
    required: true
  }
})

// State
const mode = ref('select') // 'select' | 'direct'
const selectedProcess = ref('')
const selectedModel = ref('')
const typeInput = ref('')
const directInput = ref('')
const containerRef = ref(null)
const processSearchRef = ref(null)
const directInputRef = ref(null)

// Dropdown state
const processDropdownOpen = ref(false)
const modelDropdownOpen = ref(false)
const processSearch = ref('')
const modelSearch = ref('')

// Available options from parent
const availableProcesses = computed(() => {
  return props.params.colDef?.cellEditorParams?.processes || []
})

// Model list (dynamically fetched)
const availableModels = ref([])
const loadingModels = ref(false)

// Prefix
const prefix = computed(() => {
  return props.params.colDef?.cellEditorParams?.prefix || 'EMAIL-'
})

// Parse existing category value
const parseCategory = (value) => {
  if (!value || typeof value !== 'string') {
    return { process: '', model: '', type: '' }
  }

  const prefixStr = prefix.value
  if (!value.startsWith(prefixStr)) {
    return { process: '', model: '', type: '', directValue: value }
  }

  const parts = value.substring(prefixStr.length).split('-')
  return {
    process: parts[0] || '',
    model: parts[1] || '',
    type: parts.slice(2).join('-') || ''
  }
}

// Preview category
const previewCategory = computed(() => {
  if (mode.value === 'direct') {
    const value = directInput.value.trim()
    if (!value) return prefix.value
    // If user already typed prefix, don't add it again
    if (value.toUpperCase().startsWith(prefix.value)) {
      return value
    }
    return `${prefix.value}${value}`
  }

  const parts = [prefix.value.replace(/-$/, '')] // Remove trailing hyphen for join

  // Check if model already starts with process name to avoid duplication
  const modelStartsWithProcess = selectedModel.value && selectedProcess.value &&
    selectedModel.value.toUpperCase().startsWith(selectedProcess.value.toUpperCase() + '-')

  if (selectedProcess.value && !modelStartsWithProcess) {
    parts.push(selectedProcess.value)
  }
  if (selectedModel.value) parts.push(selectedModel.value)
  if (typeInput.value.trim()) parts.push(typeInput.value.trim())

  return parts.join('-')
})

// Filtered processes for dropdown
const filteredProcesses = computed(() => {
  const search = processSearch.value.toLowerCase()
  if (!search) return availableProcesses.value
  return availableProcesses.value.filter(p =>
    p.toLowerCase().includes(search)
  )
})

// Filtered models for dropdown
const filteredModels = computed(() => {
  const search = modelSearch.value.toLowerCase()
  if (!search) return availableModels.value
  return availableModels.value.filter(m =>
    m.toLowerCase().includes(search)
  )
})

// Fetch models when process changes
const fetchModels = async (process) => {
  if (!process) {
    availableModels.value = []
    return
  }

  const fetchFn = props.params.colDef?.cellEditorParams?.fetchModels
  if (!fetchFn) {
    availableModels.value = []
    return
  }

  loadingModels.value = true
  try {
    const models = await fetchFn(process)
    availableModels.value = models || []
  } catch (error) {
    console.error('Failed to fetch models:', error)
    availableModels.value = []
  } finally {
    loadingModels.value = false
  }
}

// Watch process selection
watch(selectedProcess, async (newProcess, oldProcess) => {
  if (newProcess !== oldProcess) {
    selectedModel.value = ''
    modelSearch.value = ''
    await fetchModels(newProcess)
  }
})

// Select handlers
const selectProcess = (process) => {
  selectedProcess.value = process
  processSearch.value = ''
  processDropdownOpen.value = false
}

const selectModel = (model) => {
  selectedModel.value = model
  modelSearch.value = ''
  modelDropdownOpen.value = false
}

// Close dropdowns when clicking outside
const handleClickOutside = (event) => {
  const target = event.target
  if (!target.closest('.process-dropdown')) {
    processDropdownOpen.value = false
  }
  if (!target.closest('.model-dropdown')) {
    modelDropdownOpen.value = false
  }
}

// Handle keyboard events
const handleKeyDown = (event) => {
  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    props.params.stopEditing(true) // Cancel
  }
}

// Close editor and save
const handleApply = () => {
  props.params.stopEditing()
}

// Cancel and close
const handleCancel = () => {
  props.params.stopEditing(true)
}

// AG Grid editor interface methods
defineExpose({
  getValue() {
    return previewCategory.value
  },
  isPopup() {
    return true
  },
  getPopupPosition() {
    return getOptimalPopupPosition(props.params, 450)
  }
})

onMounted(async () => {
  // Parse current value
  const currentValue = props.params.value
  const parsed = parseCategory(currentValue)

  if (parsed.directValue !== undefined) {
    // Value doesn't match expected format, use direct mode
    mode.value = 'direct'
    directInput.value = currentValue || ''
  } else if (parsed.process) {
    // Has valid parsed process, use select mode
    mode.value = 'select'
    selectedProcess.value = parsed.process
    typeInput.value = parsed.type

    // Fetch models for the process, then set model
    await fetchModels(parsed.process)
    if (parsed.model && availableModels.value.includes(parsed.model)) {
      selectedModel.value = parsed.model
    }
  }

  // Add click outside listener
  document.addEventListener('click', handleClickOutside)

  // Focus based on mode
  nextTick(() => {
    if (mode.value === 'direct') {
      directInputRef.value?.focus()
    }
  })
})

// Cleanup
import { onUnmounted } from 'vue'
onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <div
    ref="containerRef"
    class="ag-category-editor bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-lg shadow-lg"
    @keydown="handleKeyDown"
  >
    <!-- Header -->
    <div class="px-4 py-3 border-b border-gray-200 dark:border-dark-border">
      <h3 class="text-sm font-semibold text-gray-900 dark:text-white">Category Editor</h3>
    </div>

    <!-- Mode Toggle -->
    <div class="px-4 py-3 border-b border-gray-100 dark:border-dark-border/50">
      <div class="flex items-center gap-6">
        <label class="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            v-model="mode"
            value="select"
            class="w-4 h-4 text-primary-500 border-gray-300 dark:border-gray-600 focus:ring-primary-500"
          />
          <span class="text-sm text-gray-700 dark:text-gray-300">Select</span>
        </label>
        <label class="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            v-model="mode"
            value="direct"
            class="w-4 h-4 text-primary-500 border-gray-300 dark:border-gray-600 focus:ring-primary-500"
          />
          <span class="text-sm text-gray-700 dark:text-gray-300">Direct Input</span>
        </label>
      </div>
    </div>

    <!-- Content -->
    <div class="px-4 py-3 space-y-3">
      <!-- Select Mode -->
      <template v-if="mode === 'select'">
        <!-- Process Dropdown -->
        <div class="space-y-1">
          <label class="block text-xs font-medium text-gray-600 dark:text-gray-400">Process</label>
          <div class="relative process-dropdown">
            <button
              type="button"
              @click.stop="processDropdownOpen = !processDropdownOpen"
              class="w-full flex items-center justify-between px-3 py-2 text-sm bg-gray-50 dark:bg-dark-border border border-gray-200 dark:border-gray-600 rounded-md text-left hover:border-primary-300 dark:hover:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <span :class="selectedProcess ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'">
                {{ selectedProcess || 'Select Process...' }}
              </span>
              <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            <!-- Dropdown Menu -->
            <div
              v-if="processDropdownOpen"
              class="absolute z-50 w-full mt-1 bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-md shadow-lg max-h-48 overflow-hidden"
            >
              <!-- Search Input -->
              <div class="p-2 border-b border-gray-100 dark:border-dark-border/50">
                <input
                  ref="processSearchRef"
                  v-model="processSearch"
                  type="text"
                  placeholder="Search..."
                  class="w-full px-2 py-1 text-sm border border-gray-200 dark:border-gray-600 rounded bg-gray-50 dark:bg-dark-border text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
                  @click.stop
                />
              </div>
              <!-- Options -->
              <div class="max-h-32 overflow-y-auto">
                <button
                  v-for="process in filteredProcesses"
                  :key="process"
                  type="button"
                  @click.stop="selectProcess(process)"
                  class="w-full px-3 py-2 text-sm text-left hover:bg-gray-100 dark:hover:bg-dark-border transition-colors"
                  :class="selectedProcess === process ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300' : 'text-gray-700 dark:text-gray-300'"
                >
                  {{ process }}
                </button>
                <div v-if="filteredProcesses.length === 0" class="px-3 py-2 text-sm text-gray-400 dark:text-gray-500">
                  No results found
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Model Dropdown -->
        <div class="space-y-1">
          <label class="block text-xs font-medium text-gray-600 dark:text-gray-400">Model</label>
          <div class="relative model-dropdown">
            <button
              type="button"
              @click.stop="modelDropdownOpen = !modelDropdownOpen"
              :disabled="!selectedProcess || loadingModels"
              class="w-full flex items-center justify-between px-3 py-2 text-sm bg-gray-50 dark:bg-dark-border border border-gray-200 dark:border-gray-600 rounded-md text-left hover:border-primary-300 dark:hover:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span :class="selectedModel ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'">
                <template v-if="loadingModels">Loading...</template>
                <template v-else>{{ selectedModel || 'Select Model...' }}</template>
              </span>
              <svg v-if="loadingModels" class="w-4 h-4 text-gray-400 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <svg v-else class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            <!-- Dropdown Menu -->
            <div
              v-if="modelDropdownOpen && !loadingModels"
              class="absolute z-50 w-full mt-1 bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-md shadow-lg max-h-48 overflow-hidden"
            >
              <!-- Search Input -->
              <div class="p-2 border-b border-gray-100 dark:border-dark-border/50">
                <input
                  v-model="modelSearch"
                  type="text"
                  placeholder="Search..."
                  class="w-full px-2 py-1 text-sm border border-gray-200 dark:border-gray-600 rounded bg-gray-50 dark:bg-dark-border text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
                  @click.stop
                />
              </div>
              <!-- Options -->
              <div class="max-h-32 overflow-y-auto">
                <button
                  v-for="model in filteredModels"
                  :key="model"
                  type="button"
                  @click.stop="selectModel(model)"
                  class="w-full px-3 py-2 text-sm text-left hover:bg-gray-100 dark:hover:bg-dark-border transition-colors"
                  :class="selectedModel === model ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300' : 'text-gray-700 dark:text-gray-300'"
                >
                  {{ model }}
                </button>
                <div v-if="filteredModels.length === 0" class="px-3 py-2 text-sm text-gray-400 dark:text-gray-500">
                  {{ availableModels.length === 0 ? 'No models available' : 'No results found' }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Type Input (Optional) -->
        <div class="space-y-1">
          <label class="block text-xs font-medium text-gray-600 dark:text-gray-400">
            Type <span class="text-gray-400 dark:text-gray-500">(optional)</span>
          </label>
          <input
            v-model="typeInput"
            type="text"
            placeholder="e.g., ALERT, INFO..."
            class="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-dark-border border border-gray-200 dark:border-gray-600 rounded-md text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </template>

      <!-- Direct Mode -->
      <template v-else>
        <div class="space-y-1">
          <label class="block text-xs font-medium text-gray-600 dark:text-gray-400">Category Value</label>
          <div class="flex items-center">
            <span class="px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 border border-r-0 border-gray-200 dark:border-gray-600 rounded-l-md text-gray-500 dark:text-gray-400">
              {{ prefix }}
            </span>
            <input
              ref="directInputRef"
              v-model="directInput"
              type="text"
              placeholder="Enter category..."
              class="flex-1 px-3 py-2 text-sm bg-gray-50 dark:bg-dark-border border border-gray-200 dark:border-gray-600 rounded-r-md text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
      </template>
    </div>

    <!-- Preview -->
    <div class="mx-4 px-3 py-2 bg-gray-50 dark:bg-dark-border/50 rounded-md">
      <span class="text-xs text-gray-500 dark:text-gray-400">Preview: </span>
      <span class="text-sm font-mono text-gray-900 dark:text-white">{{ previewCategory }}</span>
    </div>

    <!-- Footer -->
    <div class="px-4 py-3 border-t border-gray-200 dark:border-dark-border flex items-center justify-end gap-2 mt-3">
      <button
        @click="handleCancel"
        type="button"
        class="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-dark-border hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
      >
        Cancel
      </button>
      <button
        @click="handleApply"
        type="button"
        class="px-3 py-1.5 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded transition-colors"
      >
        Apply
      </button>
    </div>
  </div>
</template>

<style scoped>
.ag-category-editor {
  min-width: 320px;
  max-width: 400px;
}
</style>
