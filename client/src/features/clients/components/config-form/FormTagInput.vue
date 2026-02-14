<template>
  <div>
    <div
      class="flex flex-wrap gap-1.5 p-2 border rounded-lg bg-gray-50 dark:bg-dark-bg border-gray-300 dark:border-dark-border min-h-[38px] cursor-text transition-colors"
      :class="{ 'border-primary-500 dark:border-primary-400 bg-white dark:bg-dark-card': focused, 'opacity-60 cursor-not-allowed': readOnly }"
      @click="focusInput"
    >
      <span
        v-for="(item, idx) in modelValue"
        :key="idx"
        class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-sm bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300"
      >
        {{ displayValue(item) }}
        <button
          v-if="!readOnly"
          type="button"
          class="text-primary-400 hover:text-red-500 transition-colors leading-none"
          @click.stop="removeTag(idx)"
        >
          &times;
        </button>
      </span>
      <input
        v-if="!readOnly"
        ref="inputRef"
        type="text"
        class="flex-1 min-w-[80px] bg-transparent border-none outline-none text-sm text-gray-700 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-500"
        :placeholder="modelValue.length === 0 ? placeholder : ''"
        @keydown.enter.prevent="addTag"
        @focus="focused = true"
        @blur="focused = false"
      />
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  placeholder: { type: String, default: '' },
  objectKey: { type: String, default: null },
  readOnly: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue'])

const inputRef = ref(null)
const focused = ref(false)

function displayValue(item) {
  if (props.objectKey && typeof item === 'object') {
    return item[props.objectKey] || ''
  }
  return String(item)
}

function focusInput() {
  if (!props.readOnly && inputRef.value) {
    inputRef.value.focus()
  }
}

function addTag() {
  const val = inputRef.value?.value?.trim()
  if (!val) return

  const newItem = props.objectKey ? { [props.objectKey]: val } : val

  // 중복 체크
  const exists = props.modelValue.some(item => displayValue(item) === val)
  if (exists) {
    inputRef.value.value = ''
    return
  }

  emit('update:modelValue', [...props.modelValue, newItem])
  inputRef.value.value = ''
}

function removeTag(idx) {
  const updated = [...props.modelValue]
  updated.splice(idx, 1)
  emit('update:modelValue', updated)
}
</script>
