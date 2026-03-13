<template>
  <div class="flex items-center gap-3 px-4 py-2 border-b border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg shrink-0 flex-wrap">
    <!-- Baseline selector -->
    <div class="flex items-center gap-1.5">
      <label class="text-xs font-medium text-gray-500 dark:text-gray-400">Baseline:</label>
      <select
        :value="baselineEqpId"
        @change="$emit('update:baselineEqpId', $event.target.value)"
        class="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-dark-card text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
      >
        <option v-for="client in clients" :key="client.eqpId || client.id" :value="client.eqpId || client.id">
          {{ client.eqpId || client.id }}
        </option>
      </select>
    </div>

    <!-- Diff only toggle -->
    <label class="flex items-center gap-1.5 cursor-pointer select-none">
      <input
        type="checkbox"
        :checked="diffOnly"
        @change="$emit('toggle-diff-only')"
        class="rounded border-gray-300 dark:border-gray-600 text-primary-500 focus:ring-primary-500"
      >
      <span class="text-xs text-gray-600 dark:text-gray-400">Diff Only</span>
    </label>

    <!-- Search -->
    <div class="relative flex-1 max-w-xs">
      <svg class="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <input
        type="text"
        :value="searchQuery"
        @input="onSearchInput"
        placeholder="Search keys..."
        class="w-full pl-7 pr-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-dark-card text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-primary-500"
      >
    </div>

    <!-- Spacer -->
    <div class="flex-1"></div>

    <!-- Expand/Collapse -->
    <div class="flex items-center gap-1">
      <button
        @click="$emit('expand-all')"
        class="px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition"
      >Expand All</button>
      <button
        @click="$emit('collapse-all')"
        class="px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition"
      >Collapse All</button>
    </div>
  </div>
</template>

<script setup>
let debounceTimer = null

defineProps({
  baselineEqpId: String,
  clients: Array,
  diffOnly: Boolean,
  searchQuery: String
})

const emit = defineEmits(['update:baselineEqpId', 'toggle-diff-only', 'search', 'expand-all', 'collapse-all'])

function onSearchInput(e) {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    emit('search', e.target.value)
  }, 300)
}
</script>
