<template>
  <Teleport to="body">
    <div
      v-if="show"
      role="dialog"
      aria-modal="true"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      @click.self="$emit('close')"
    >
      <div class="bg-white dark:bg-dark-card rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <!-- Header -->
        <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-dark-border">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <svg class="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            Validation Errors ({{ errorCount }} items)
          </h3>
          <button
            @click="$emit('close')"
            class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Error List -->
        <div class="flex-1 overflow-y-auto px-6 py-4">
          <div v-for="(rowErrors, rowId) in errors" :key="rowId" class="mb-4 last:mb-0">
            <div class="font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
              <span class="px-2 py-0.5 bg-gray-100 dark:bg-dark-border rounded text-xs font-mono">
                {{ getRowIdentifier(rowId) }}
              </span>
              <span
                v-if="rowId.startsWith('server_row_')"
                class="px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 rounded text-xs"
              >
                Server Error
              </span>
            </div>
            <ul class="space-y-1 pl-4">
              <li
                v-for="(message, field) in rowErrors"
                :key="field"
                class="flex items-start gap-2 text-sm"
              >
                <span class="font-medium text-red-600 dark:text-red-400 min-w-[100px]">{{ field }}:</span>
                <span class="text-gray-600 dark:text-gray-400">{{ message }}</span>
              </li>
            </ul>
          </div>
        </div>

        <!-- Footer -->
        <div class="px-6 py-4 border-t border-gray-200 dark:border-dark-border flex justify-end">
          <button
            @click="$emit('close')"
            class="px-4 py-2 bg-gray-100 dark:bg-dark-border hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
defineProps({
  show: {
    type: Boolean,
    required: true
  },
  errors: {
    type: Object,
    required: true
  },
  errorCount: {
    type: Number,
    required: true
  },
  getRowIdentifier: {
    type: Function,
    required: true
  }
})

defineEmits(['close'])
</script>
