<script setup>
import { computed } from 'vue'
import { findSection } from '../toc'

const props = defineProps({
  sectionId: { type: String, default: '' }
})

const section = computed(() => findSection(props.sectionId))
</script>

<template>
  <nav v-if="section" class="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
    <span class="text-gray-400 dark:text-gray-500">User Manual</span>
    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
    </svg>
    <span class="text-gray-400 dark:text-gray-500">{{ section.chapterLabel }}</span>
    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
    </svg>
    <span class="text-gray-700 dark:text-gray-200 font-medium">{{ section.label }}</span>
  </nav>
</template>
