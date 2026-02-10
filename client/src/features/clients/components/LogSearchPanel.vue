<template>
  <div class="border-t border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg shrink-0" style="max-height: 200px">
    <!-- Search bar -->
    <div class="flex items-center gap-2 px-3 py-1.5 border-b border-gray-200 dark:border-dark-border">
      <svg class="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <input
        v-model="search.searchQuery.value"
        @keydown.enter="doSearch"
        type="text"
        placeholder="Search across all open files..."
        class="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-dark-border rounded bg-white dark:bg-dark-card text-gray-900 dark:text-white"
      />
      <label class="flex items-center gap-1 text-xs text-gray-500">
        <input type="checkbox" v-model="search.isRegex.value" class="w-3 h-3" /> Regex
      </label>
      <button @click="doSearch" class="px-2 py-1 text-xs bg-primary-500 text-white rounded hover:bg-primary-600 transition">Search</button>
      <button @click="$emit('close')" class="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <!-- Results -->
    <div class="overflow-y-auto" style="max-height: 160px">
      <div v-if="search.searching.value" class="px-3 py-2 text-sm text-gray-400">Searching...</div>
      <div v-else-if="search.searchError.value" class="px-3 py-2 text-sm text-red-500">{{ search.searchError.value }}</div>
      <div v-else-if="search.searchResults.value.length === 0 && search.searchQuery.value" class="px-3 py-2 text-sm text-gray-400">No results found</div>
      <div v-else>
        <button
          v-for="(result, idx) in search.searchResults.value"
          :key="idx"
          @click="$emit('go-to', result)"
          class="w-full text-left px-3 py-1 hover:bg-gray-100 dark:hover:bg-dark-hover border-b border-gray-100 dark:border-gray-800 text-xs font-mono"
        >
          <span class="text-gray-500">{{ result.clientName }} &gt; {{ result.fileName }} : L{{ result.lineNum }}</span>
          <span class="text-gray-300 dark:text-gray-500 mx-1">|</span>
          <span class="text-gray-700 dark:text-gray-300">{{ result.lineContent }}</span>
        </button>
      </div>
      <div v-if="search.searchResults.value.length > 0" class="px-3 py-1 text-xs text-gray-400 bg-gray-100 dark:bg-dark-bg">
        {{ search.searchResults.value.length }} results found
      </div>
    </div>
  </div>
</template>

<script setup>
import { useLogSearch } from '../composables/useLogSearch'

const props = defineProps({
  globalContents: { type: Object, required: true },
  globalOpenTabs: { type: Array, required: true },
  selectedClients: { type: Array, required: true }
})

const emit = defineEmits(['go-to', 'close', 'searched'])

const search = useLogSearch()

function doSearch() {
  search.searchAll(props.globalContents, props.globalOpenTabs, props.selectedClients)
  emit('searched', search.searchResults.value)
}
</script>
