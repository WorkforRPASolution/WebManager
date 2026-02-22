<template>
  <div>
    <div
      class="flex flex-wrap gap-1.5 p-2 border rounded-lg bg-gray-50 dark:bg-dark-bg border-gray-300 dark:border-dark-border min-h-[38px] cursor-text transition-colors"
      :class="{ 'border-primary-500 dark:border-primary-400 bg-white dark:bg-dark-card': focused, 'opacity-60 cursor-not-allowed': readOnly }"
      @click="focusInput"
    >
      <template v-for="(item, idx) in modelValue" :key="idx">
        <!-- Editing mode -->
        <input
          v-if="editingIndex === idx"
          :ref="el => { if (el) editInputRef = el }"
          type="text"
          class="px-2 py-0.5 rounded-md text-sm border-2 border-primary-400 dark:border-primary-500 bg-white dark:bg-dark-card text-gray-700 dark:text-gray-300 outline-none"
          :style="{ width: Math.max(120, editingValue.length * 8 + 24) + 'px' }"
          :value="editingValue"
          @input="editingValue = $event.target.value"
          @keydown.enter.prevent="commitEdit"
          @keydown.escape.prevent="cancelEdit"
          @blur="commitEdit"
        />
        <!-- Display mode -->
        <span
          v-else
          class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-sm cursor-pointer transition-colors"
          :class="idx === selectedIndex
            ? 'bg-primary-500 text-white ring-2 ring-primary-300 dark:ring-primary-700'
            : 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 hover:bg-primary-200 dark:hover:bg-primary-900/50'"
          @click.stop="onTagClick(idx)"
          @dblclick.stop="startEdit(idx)"
        >
          {{ displayValue(item) }}
          <span v-if="hasParams(item)" class="text-xs ml-0.5 font-bold" :class="idx === selectedIndex ? 'text-amber-200' : 'text-amber-500'" title="params 조건 있음">P</span>
          <button
            v-if="!readOnly"
            type="button"
            class="transition-colors leading-none"
            :class="idx === selectedIndex ? 'text-white/70 hover:text-red-200' : 'text-primary-400 hover:text-red-500'"
            @click.stop="removeTag(idx)"
          >
            &times;
          </button>
        </span>
      </template>
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
import { ref, nextTick } from 'vue'

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  placeholder: { type: String, default: '' },
  objectKey: { type: String, default: null },
  readOnly: { type: Boolean, default: false },
  selectedIndex: { type: Number, default: -1 }
})

const emit = defineEmits(['update:modelValue', 'select'])

const inputRef = ref(null)
const focused = ref(false)

const editingIndex = ref(-1)
const editingValue = ref('')
const editInputRef = ref(null)

function displayValue(item) {
  if (props.objectKey && typeof item === 'object') {
    return item[props.objectKey] || ''
  }
  return String(item)
}

function hasParams(item) {
  return item && typeof item === 'object' && !!item.params
}

function focusInput() {
  if (!props.readOnly && inputRef.value) {
    inputRef.value.focus()
  }
}

function onTagClick(idx) {
  emit('select', idx === props.selectedIndex ? -1 : idx)
}

function startEdit(idx) {
  if (props.readOnly) return
  editingIndex.value = idx
  editingValue.value = displayValue(props.modelValue[idx])
  nextTick(() => {
    if (editInputRef.value) {
      editInputRef.value.focus()
      editInputRef.value.select()
    }
  })
}

function commitEdit() {
  const idx = editingIndex.value
  if (idx < 0) return
  const val = editingValue.value.trim()
  editingIndex.value = -1
  if (!val || val === displayValue(props.modelValue[idx])) return

  // 중복 체크
  const exists = props.modelValue.some((item, i) => i !== idx && displayValue(item) === val)
  if (exists) return

  const updated = [...props.modelValue]
  if (props.objectKey && typeof updated[idx] === 'object') {
    updated[idx] = { ...updated[idx], [props.objectKey]: val }
  } else {
    updated[idx] = props.objectKey ? { [props.objectKey]: val } : val
  }
  emit('update:modelValue', updated)
}

function cancelEdit() {
  editingIndex.value = -1
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
  if (props.selectedIndex === idx) {
    emit('select', -1)
  } else if (props.selectedIndex > idx) {
    emit('select', props.selectedIndex - 1)
  }
}
</script>
