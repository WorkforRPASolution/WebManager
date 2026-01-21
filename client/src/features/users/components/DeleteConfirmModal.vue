<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 z-50 flex items-center justify-center"
      @click.self="$emit('update:modelValue', false)"
    >
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-black/50"></div>

      <!-- Dialog -->
      <div class="relative bg-white dark:bg-dark-card rounded-xl shadow-2xl w-[400px] p-6">
        <!-- Icon -->
        <div class="flex justify-center mb-4">
          <div class="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
            <svg class="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
        </div>

        <!-- Title -->
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white text-center mb-2">
          Delete Users
        </h3>

        <!-- Message -->
        <p class="text-sm text-gray-600 dark:text-gray-400 text-center mb-6">
          Are you sure you want to delete {{ count }} user{{ count > 1 ? 's' : '' }}? This action cannot be undone.
        </p>

        <!-- Actions -->
        <div class="flex gap-3">
          <button
            @click="$emit('update:modelValue', false)"
            class="flex-1 px-4 py-2 bg-gray-100 dark:bg-dark-border hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            @click="handleConfirm"
            class="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
defineProps({
  modelValue: { type: Boolean, default: false },
  count: { type: Number, default: 0 }
})

const emit = defineEmits(['update:modelValue', 'confirm'])

const handleConfirm = () => {
  emit('confirm')
  emit('update:modelValue', false)
}
</script>
