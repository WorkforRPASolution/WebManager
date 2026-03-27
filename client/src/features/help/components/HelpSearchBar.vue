<script setup>
import { ref, watch } from 'vue'
import { useHelpSearch } from '../composables/useHelpSearch'

const emit = defineEmits(['navigate'])

const { query, results, isOpen, clear } = useHelpSearch()
const inputRef = ref(null)
const selectedIndex = ref(-1)

watch(results, () => {
  selectedIndex.value = -1
})

function handleSelect(section) {
  emit('navigate', section.id)
  clear()
  inputRef.value?.blur()
}

function handleKeydown(e) {
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (selectedIndex.value < results.value.length - 1) selectedIndex.value++
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (selectedIndex.value > 0) selectedIndex.value--
  } else if (e.key === 'Enter') {
    e.preventDefault()
    if (selectedIndex.value >= 0 && results.value[selectedIndex.value]) {
      handleSelect(results.value[selectedIndex.value])
    }
  } else if (e.key === 'Escape') {
    clear()
    inputRef.value?.blur()
  }
}
</script>

<template>
  <div class="relative px-4 py-3 border-b border-gray-200 dark:border-dark-border bg-white dark:bg-dark-card">
    <div class="relative max-w-xl">
      <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
      </svg>
      <input
        ref="inputRef"
        v-model="query"
        @focus="isOpen = true"
        @keydown="handleKeydown"
        type="text"
        placeholder="매뉴얼 검색... (키워드 입력)"
        class="w-full pl-10 pr-8 py-2 text-sm bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 text-gray-700 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-500"
      >
      <button
        v-if="query"
        @click="clear(); inputRef?.focus()"
        class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>

    <!-- Search Results Dropdown -->
    <div
      v-if="isOpen && results.length > 0"
      class="absolute left-4 right-4 top-full mt-1 bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto"
    >
      <button
        v-for="(result, i) in results"
        :key="result.id"
        @click="handleSelect(result)"
        @mouseenter="selectedIndex = i"
        class="w-full text-left px-4 py-3 flex flex-col border-b border-gray-50 dark:border-dark-border last:border-0 transition-colors"
        :class="selectedIndex === i
          ? 'bg-primary-50 dark:bg-primary-900/20'
          : 'hover:bg-gray-50 dark:hover:bg-dark-bg'"
      >
        <span class="text-xs text-gray-400 dark:text-gray-500">{{ result.chapterLabel }}</span>
        <span class="text-sm font-medium text-gray-800 dark:text-gray-200">{{ result.label }}</span>
      </button>
    </div>

    <!-- No Results -->
    <div
      v-if="isOpen && query.length >= 2 && results.length === 0"
      class="absolute left-4 right-4 top-full mt-1 bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-lg shadow-lg z-50 p-4 text-center"
    >
      <p class="text-sm text-gray-500 dark:text-gray-400">검색 결과가 없습니다</p>
    </div>

    <!-- Click outside to close -->
    <div
      v-if="isOpen && (results.length > 0 || query.length >= 2)"
      class="fixed inset-0 z-40"
      @click="isOpen = false"
    ></div>
  </div>
</template>
