<template>
  <div class="ml-2">
    <div class="flex items-center gap-1.5 py-0.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded px-1 cursor-pointer" @click="handleToggle">
      <!-- Expand/collapse for objects -->
      <button
        v-if="isExpandable"
        class="w-4 h-4 flex items-center justify-center text-gray-400 shrink-0"
        @click.stop="expanded = !expanded"
      >
        <svg class="w-3 h-3 transition-transform" :class="{ 'rotate-90': expanded }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
      </button>
      <div v-else class="w-4 shrink-0"></div>

      <!-- Checkbox -->
      <input
        type="checkbox"
        :checked="isSelected"
        @click.stop="handleToggle"
        class="w-3.5 h-3.5 rounded border-gray-300 dark:border-gray-600 text-primary-500 focus:ring-primary-500 shrink-0"
      />

      <!-- Key name -->
      <span class="text-gray-800 dark:text-gray-200 font-medium truncate">{{ nodeKey }}</span>

      <!-- Value preview for non-objects -->
      <span v-if="!isExpandable" class="text-gray-400 dark:text-gray-500 truncate ml-1">
        : {{ valuePreview }}
      </span>

      <!-- Type badge for objects/arrays -->
      <span v-if="isExpandable" class="text-gray-400 dark:text-gray-500 text-xs ml-1">
        {{ typeBadge }}
      </span>
    </div>

    <!-- Children -->
    <div v-if="isExpandable && expanded">
      <JsonTreeNode
        v-for="(childValue, childKey) in value"
        :key="childKey"
        :nodeKey="String(childKey)"
        :value="childValue"
        :path="`${path}.${childKey}`"
        :selected-keys="selectedKeys"
        @toggle="$emit('toggle', $event)"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  nodeKey: String,
  value: [Object, Array, String, Number, Boolean, null],
  path: String,
  selectedKeys: Set
})

const emit = defineEmits(['toggle'])

const expanded = ref(false)

const isExpandable = computed(() =>
  props.value !== null && typeof props.value === 'object'
)

const typeBadge = computed(() => {
  if (!isExpandable.value) return ''
  if (Array.isArray(props.value)) return `[${props.value.length}]`
  return `{${Object.keys(props.value).length}}`
})

const isSelected = computed(() =>
  props.selectedKeys.has(props.path)
)

const valuePreview = computed(() => {
  if (props.value === null) return 'null'
  if (typeof props.value === 'string') return `"${props.value.length > 30 ? props.value.substring(0, 30) + '...' : props.value}"`
  return String(props.value)
})

function handleToggle() {
  emit('toggle', props.path)
}
</script>
