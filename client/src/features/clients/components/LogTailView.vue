<template>
  <div class="h-full flex flex-col bg-gray-900 font-mono text-sm">
    <!-- Header -->
    <div class="flex items-center justify-between px-3 py-1 bg-gray-800 text-gray-400 text-xs shrink-0">
      <div class="flex items-center gap-2">
        <span class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
        <span>Tailing: {{ fileName }}</span>
      </div>
      <div class="flex items-center gap-2">
        <button @click="$emit('clear')" class="px-2 py-0.5 hover:text-white transition">Clear</button>
        <button @click="$emit('stop')" class="px-2 py-0.5 text-red-400 hover:text-red-300 transition">Stop</button>
      </div>
    </div>

    <!-- Content -->
    <div ref="scrollContainer" class="flex-1 overflow-y-auto p-3" @scroll="handleScroll">
      <div v-if="truncated" class="text-yellow-500 mb-2 text-xs">[Previous lines omitted - buffer limit reached]</div>
      <div v-if="error" class="text-red-400 mb-2">Error: {{ error }}</div>
      <pre class="text-gray-300 whitespace-pre-wrap break-all text-xs leading-5">{{ lines.join('\n') }}</pre>
      <div v-if="lines.length === 0 && !error" class="text-gray-600">Waiting for log data...</div>
    </div>

    <!-- Auto-scroll indicator -->
    <div v-if="!autoScroll" class="flex items-center justify-center py-1 bg-gray-800 shrink-0">
      <button @click="resumeAutoScroll" class="text-xs text-primary-400 hover:text-primary-300 transition">
        Resume auto-scroll
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'

const props = defineProps({
  lines: { type: Array, default: () => [] },
  fileName: { type: String, default: '' },
  truncated: { type: Boolean, default: false },
  error: { type: String, default: null }
})

defineEmits(['stop', 'clear'])

const scrollContainer = ref(null)
const autoScroll = ref(true)

function handleScroll() {
  if (!scrollContainer.value) return
  const el = scrollContainer.value
  const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50
  autoScroll.value = atBottom
}

function resumeAutoScroll() {
  autoScroll.value = true
  scrollToBottom()
}

function scrollToBottom() {
  if (!scrollContainer.value) return
  scrollContainer.value.scrollTop = scrollContainer.value.scrollHeight
}

// Auto-scroll when new lines arrive
watch(() => props.lines.length, () => {
  if (autoScroll.value) {
    nextTick(scrollToBottom)
  }
})
</script>
