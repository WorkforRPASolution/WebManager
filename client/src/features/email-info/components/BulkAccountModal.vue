<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      @click.self="handleCancel"
    >
      <div class="bg-white dark:bg-dark-card rounded-lg shadow-xl w-full max-w-md">
        <!-- Header -->
        <div class="px-6 py-4 border-b border-gray-200 dark:border-dark-border">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Bulk Account Operation</h3>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">{{ selectedCount }} rows selected</p>
        </div>

        <!-- Body -->
        <div class="px-6 py-4 space-y-4">
          <!-- Account input -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Account Email</label>
            <input
              v-model="accountInput"
              type="email"
              placeholder="user@example.com"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-bg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              @keyup.enter="handleApply"
            />
          </div>

          <!-- Operation type -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Operation</label>
            <div class="flex gap-4">
              <label class="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  v-model="operation"
                  value="add"
                  class="w-4 h-4 text-primary-500 focus:ring-primary-500 border-gray-300 dark:border-gray-600"
                />
                <span class="text-sm text-gray-700 dark:text-gray-300">Add to selected</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  v-model="operation"
                  value="remove"
                  class="w-4 h-4 text-primary-500 focus:ring-primary-500 border-gray-300 dark:border-gray-600"
                />
                <span class="text-sm text-gray-700 dark:text-gray-300">Remove from selected</span>
              </label>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="px-6 py-4 border-t border-gray-200 dark:border-dark-border flex justify-end gap-3">
          <button
            @click="handleCancel"
            class="px-4 py-2 bg-gray-100 dark:bg-dark-border hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            @click="handleApply"
            :disabled="!accountInput.trim()"
            class="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  selectedCount: {
    type: Number,
    default: 0
  }
})

const emit = defineEmits(['update:modelValue', 'apply'])

const accountInput = ref('')
const operation = ref('add')

// Reset on close
watch(() => props.modelValue, (val) => {
  if (!val) {
    accountInput.value = ''
    operation.value = 'add'
  }
})

const handleCancel = () => {
  emit('update:modelValue', false)
}

const handleApply = () => {
  if (!accountInput.value.trim()) return
  emit('apply', { account: accountInput.value.trim(), operation: operation.value })
}
</script>
