<template>
  <div class="json-tree-selector text-sm">
    <div v-for="(value, key) in parsedJson" :key="key">
      <JsonTreeNode
        :nodeKey="key"
        :value="value"
        :path="key"
        :selected-keys="selectedKeys"
        @toggle="toggleKey"
      />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import JsonTreeNode from './JsonTreeNode.vue'

const props = defineProps({
  json: {
    type: [Object, String],
    required: true
  },
  selectedKeys: {
    type: Set,
    default: () => new Set()
  }
})

const emit = defineEmits(['update:selectedKeys'])

const parsedJson = computed(() => {
  if (typeof props.json === 'string') {
    try { return JSON.parse(props.json) } catch { return {} }
  }
  return props.json || {}
})

function toggleKey(path) {
  const newSet = new Set(props.selectedKeys)
  if (newSet.has(path)) {
    // Remove this key and all children
    for (const k of newSet) {
      if (k === path || k.startsWith(path + '.')) {
        newSet.delete(k)
      }
    }
  } else {
    newSet.add(path)
  }
  emit('update:selectedKeys', newSet)
}
</script>
