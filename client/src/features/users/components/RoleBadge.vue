<template>
  <span
    class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
    :class="badgeClass"
  >
    {{ roleName }}
  </span>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  level: {
    type: Number,
    required: true
  }
})

const roleConfig = {
  0: { name: 'Admin', class: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  1: { name: 'Manager', class: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' },
  2: { name: 'User', class: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  3: { name: 'Guest', class: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400' },
}

const roleName = computed(() => roleConfig[props.level]?.name || 'Unknown')
const badgeClass = computed(() => roleConfig[props.level]?.class || 'bg-gray-100 text-gray-800')
</script>
