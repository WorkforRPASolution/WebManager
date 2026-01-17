<script setup>
import AppIcon from '../../../shared/components/AppIcon.vue'

const props = defineProps({
  count: {
    type: Number,
    required: true
  },
  names: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['confirm', 'close'])
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center">
    <!-- Backdrop -->
    <div class="absolute inset-0 bg-black/50" @click="emit('close')"></div>

    <!-- Modal -->
    <div class="relative bg-white dark:bg-dark-card rounded-lg shadow-xl w-full max-w-sm mx-4">
      <!-- Body -->
      <div class="p-6 text-center">
        <div class="w-12 h-12 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
          <AppIcon name="warning" size="6" class="text-red-500" />
        </div>

        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Delete {{ count === 1 ? 'User' : 'Users' }}?
        </h3>

        <p class="text-gray-500 dark:text-gray-400 text-sm mb-4">
          Are you sure you want to delete
          <template v-if="count === 1">
            <span class="font-medium text-gray-700 dark:text-gray-300">{{ names[0] }}</span>?
          </template>
          <template v-else>
            <span class="font-medium text-gray-700 dark:text-gray-300">{{ count }} users</span>?
          </template>
          <br>
          This action cannot be undone.
        </p>

        <div v-if="count > 1 && names.length > 0" class="mb-4 max-h-32 overflow-y-auto text-left bg-gray-50 dark:bg-dark-border rounded-lg p-3">
          <ul class="text-sm text-gray-600 dark:text-gray-400 space-y-1">
            <li v-for="name in names" :key="name" class="flex items-center gap-2">
              <span class="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
              {{ name }}
            </li>
          </ul>
        </div>
      </div>

      <!-- Footer -->
      <div class="flex items-center justify-center gap-3 px-6 py-4 border-t border-gray-200 dark:border-dark-border">
        <button
          @click="emit('close')"
          class="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-dark-border rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          Cancel
        </button>
        <button
          @click="emit('confirm')"
          class="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
        >
          Delete
        </button>
      </div>
    </div>
  </div>
</template>
