<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 z-50 flex items-center justify-center"
    >
      <!-- Backdrop -->
      <div
        class="absolute inset-0 bg-black/50"
        @click="$emit('update:modelValue', false)"
      ></div>

      <!-- Modal -->
      <div class="relative bg-white dark:bg-dark-card rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <!-- Icon -->
        <div class="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-red-100 dark:bg-red-900/30 rounded-full">
          <svg class="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>

        <!-- Title -->
        <h3 class="text-lg font-semibold text-center text-gray-900 dark:text-white mb-2">
          Delete Confirmation
        </h3>

        <!-- Message -->
        <p class="text-center text-gray-600 dark:text-gray-400 mb-6">
          Are you sure you want to delete <strong class="text-gray-900 dark:text-white">{{ count }}</strong> selected row(s)?
          This action cannot be undone.
        </p>

        <!-- Buttons -->
        <div class="flex items-center justify-center gap-3">
          <button
            @click="$emit('update:modelValue', false)"
            class="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg transition"
          >
            Cancel
          </button>
          <button
            @click="handleConfirm"
            class="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg transition"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  count: {
    type: Number,
    default: 0
  }
})

const emit = defineEmits(['update:modelValue', 'confirm'])

const handleConfirm = () => {
  emit('confirm')
  emit('update:modelValue', false)
}
</script>
