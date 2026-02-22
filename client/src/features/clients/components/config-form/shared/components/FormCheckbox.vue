<template>
  <label class="flex items-center gap-2 cursor-pointer select-none" :class="{ 'opacity-60': disabled }">
    <input type="checkbox" :checked="checked" @change="$emit('change', $event.target.checked)" :disabled="disabled" class="w-4 h-4 rounded border-gray-300 dark:border-dark-border text-primary-500 focus:ring-primary-500 dark:bg-dark-bg" />
    <span class="text-sm text-gray-700 dark:text-gray-300">{{ schema?.label }}</span>
    <span v-if="schema?.description" class="relative group">
      <svg class="w-3.5 h-3.5 text-gray-400 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span class="absolute z-50 hidden group-hover:block bottom-full left-0 mb-1 w-64 p-2 text-xs font-normal text-gray-600 dark:text-gray-300 bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-lg shadow-lg whitespace-normal">
        {{ schema?.description }}
      </span>
    </span>
  </label>
</template>

<script setup>
defineProps({
  schema: Object,
  checked: Boolean,
  disabled: Boolean
})
defineEmits(['change'])
</script>
