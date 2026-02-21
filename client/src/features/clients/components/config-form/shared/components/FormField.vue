<template>
  <div>
    <label class="flex items-center gap-1 text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
      {{ label || schema?.label }}
      <span v-if="required || schema?.required" class="text-red-400">*</span>
      <span v-if="description || schema?.description" class="relative group">
        <svg class="w-3.5 h-3.5 text-gray-400 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span class="absolute z-50 hidden group-hover:block bottom-full left-0 mb-1 w-64 p-2 text-xs font-normal text-gray-600 dark:text-gray-300 bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-lg shadow-lg whitespace-normal">
          {{ description || schema?.description }}
        </span>
      </span>
    </label>
    <slot />
  </div>
</template>

<script setup>
defineProps({
  schema: Object,
  label: String,
  description: String,
  required: Boolean
})
</script>
