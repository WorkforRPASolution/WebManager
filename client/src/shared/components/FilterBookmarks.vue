<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import AppIcon from './AppIcon.vue'

defineProps({
  bookmarks: {
    type: Array,
    default: () => []
  },
  hasFilters: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['save', 'apply', 'delete'])

const isOpen = ref(false)
const newBookmarkName = ref('')
const containerRef = ref(null)

const toggleDropdown = (event) => {
  event.stopPropagation()
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    newBookmarkName.value = ''
  }
}

const handleSave = () => {
  if (!newBookmarkName.value.trim()) return
  emit('save', newBookmarkName.value.trim())
  newBookmarkName.value = ''
}

const handleApply = (bookmark) => {
  emit('apply', bookmark)
  isOpen.value = false
}

const handleDelete = (event, id) => {
  event.stopPropagation()
  emit('delete', id)
}

const handleClickOutside = (event) => {
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
    <!-- Star Icon Button -->
    <button
      @click="toggleDropdown"
      class="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-hover transition-colors"
      :class="bookmarks.length > 0 ? 'text-yellow-500' : 'text-gray-400 dark:text-gray-500'"
      title="Filter Bookmarks"
    >
      <AppIcon name="star" size="5" />
    </button>

    <!-- Dropdown Menu -->
    <div
      v-show="isOpen"
      class="absolute right-0 top-full mt-1 w-64 bg-white dark:bg-dark-card rounded-lg border border-gray-200 dark:border-dark-border shadow-lg z-50"
    >
      <!-- Header -->
      <div class="px-3 py-2 border-b border-gray-200 dark:border-dark-border">
        <div class="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
          <AppIcon name="bookmark" size="4" />
          <span>Saved Filters</span>
        </div>
      </div>

      <!-- Bookmarks List -->
      <div class="max-h-48 overflow-y-auto">
        <div v-if="bookmarks.length === 0" class="px-3 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
          No saved filters
        </div>
        <div
          v-for="bookmark in bookmarks"
          :key="bookmark.id"
          @click="handleApply(bookmark)"
          class="flex items-center justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-dark-hover cursor-pointer group"
        >
          <span class="text-sm text-gray-700 dark:text-gray-300 truncate pr-2">{{ bookmark.name }}</span>
          <button
            @click="(e) => handleDelete(e, bookmark.id)"
            class="p-1 rounded hover:bg-gray-200 dark:hover:bg-dark-border text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
            title="Delete"
          >
            <AppIcon name="x" size="4" />
          </button>
        </div>
      </div>

      <!-- Save Current Filter -->
      <div class="px-3 py-2 border-t border-gray-200 dark:border-dark-border">
        <div class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
          <AppIcon name="save" size="4" />
          <span>Save Current Filter</span>
        </div>
        <div class="flex gap-2">
          <input
            v-model="newBookmarkName"
            type="text"
            placeholder="Enter name..."
            :disabled="!hasFilters"
            class="flex-1 px-2 py-1.5 text-sm rounded border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
            @click.stop
            @keyup.enter="handleSave"
          />
          <button
            @click.stop="handleSave"
            :disabled="!hasFilters || !newBookmarkName.trim()"
            class="px-3 py-1.5 text-sm bg-primary-500 hover:bg-primary-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded transition"
          >
            Save
          </button>
        </div>
        <p v-if="!hasFilters" class="mt-1 text-xs text-gray-400 dark:text-gray-500">
          Set filters first to save
        </p>
      </div>
    </div>
  </div>
</template>
