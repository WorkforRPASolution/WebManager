<template>
  <div class="border-t border-gray-200 dark:border-dark-border">
    <!-- Toggle Header (purple) -->
    <button
      type="button"
      class="w-full flex items-center gap-2 px-4 py-2 text-xs font-medium text-purple-600 dark:text-purple-400 hover:bg-purple-50/50 dark:hover:bg-purple-900/10 transition"
      @click="open = !open"
    >
      <svg class="w-3.5 h-3.5 transition-transform" :class="{ 'rotate-90': open }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
      </svg>
      멀티라인 블록 테스트
    </button>

    <div v-show="open" class="px-4 pb-4 space-y-4">
      <!-- Tab buttons -->
      <div class="flex gap-1 border-b border-gray-200 dark:border-dark-border">
        <button
          type="button"
          class="px-3 py-1.5 text-xs font-medium border-b-2 transition"
          :class="activeTab === 'text' ? 'border-purple-500 text-purple-600 dark:text-purple-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'"
          @click="activeTab = 'text'"
        >
          텍스트 입력
        </button>
        <button
          type="button"
          class="px-3 py-1.5 text-xs font-medium border-b-2 transition"
          :class="activeTab === 'file' ? 'border-purple-500 text-purple-600 dark:text-purple-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'"
          @click="activeTab = 'file'"
        >
          파일 시뮬레이션
        </button>
      </div>

      <!-- Text Tab -->
      <div v-if="activeTab === 'text'" class="space-y-3">
        <textarea
          v-model="logText"
          rows="8"
          placeholder="멀티라인 로그 텍스트를 입력하세요&#10;예:&#10;2026-02-18 WARN Alarm Occured EQP001&#10;  Details: Temperature over limit&#10;  Value: 95.3&#10;2026-02-18 WARN Alarm Reset EQP001"
          class="w-full px-3 py-2 text-xs font-mono border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-700 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-500 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition resize-y"
        ></textarea>
        <button
          type="button"
          class="px-3 py-1.5 text-sm font-medium text-white bg-purple-500 hover:bg-purple-600 rounded-lg transition"
          :disabled="!logText.trim()"
          @click="runTextTest"
        >
          블록 추출 테스트
        </button>
      </div>

      <!-- File Tab -->
      <div v-if="activeTab === 'file'" class="space-y-3">
        <div
          class="border-2 border-dashed border-gray-300 dark:border-dark-border rounded-lg p-4 text-center cursor-pointer hover:border-purple-400 transition"
          @click="$refs.fileInput.click()"
          @dragover.prevent
          @drop.prevent="handleFileDrop"
        >
          <input ref="fileInput" type="file" accept=".log,.txt,.csv" class="hidden" @change="handleFileSelect" />
          <svg class="w-8 h-8 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <p class="text-xs text-gray-500 dark:text-gray-400">클릭하거나 파일을 드래그&드롭하세요 (.log, .txt, .csv)</p>
        </div>

        <div v-if="uploadedFile" class="flex items-center justify-between px-2 py-1 text-xs bg-gray-50 dark:bg-dark-bg rounded">
          <span class="text-gray-700 dark:text-gray-300">{{ uploadedFile.name }} <span class="text-gray-400">({{ formatFileSize(uploadedFile.size) }})</span></span>
          <button type="button" class="text-gray-400 hover:text-red-500 transition" @click="uploadedFile = null">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <button
          type="button"
          class="px-3 py-1.5 text-sm font-medium text-white bg-purple-500 hover:bg-purple-600 rounded-lg transition"
          :disabled="!uploadedFile || fileProcessing"
          @click="runFileTest"
        >
          {{ fileProcessing ? '처리 중...' : '시뮬레이션 실행' }}
        </button>
      </div>

      <!-- Results -->
      <div v-if="testResult" class="space-y-3">
        <!-- Errors -->
        <div v-if="testResult.errors.length > 0" class="space-y-1">
          <div v-for="(err, i) in testResult.errors" :key="i" class="text-xs px-2 py-1.5 rounded bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/50">
            {{ err }}
          </div>
        </div>

        <!-- Summary bar -->
        <div class="text-xs font-medium px-3 py-2 rounded-lg bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/50">
          전체 {{ testResult.summary.totalLines }}줄 → {{ testResult.summary.blockCount }}개 블록 추출
        </div>

        <!-- Block cards -->
        <div v-for="block in testResult.blocks" :key="block.blockNum" class="rounded-lg border border-purple-200 dark:border-purple-800/50 overflow-hidden">
          <div class="px-3 py-1.5 bg-purple-50/50 dark:bg-purple-900/10 text-xs font-medium text-purple-700 dark:text-purple-300 flex items-center justify-between">
            <span>블록 #{{ block.blockNum }} (Line {{ block.startLine }}~{{ block.endLine }}, {{ block.lineCount }}줄)</span>
            <span class="text-purple-500 dark:text-purple-400">종료: {{ terminatedLabel(block.terminatedBy) }}</span>
          </div>
          <div class="px-3 py-2 font-mono text-xs text-gray-700 dark:text-gray-300 overflow-x-auto whitespace-nowrap">
            {{ block.lines.map(l => l.text).join('') }}
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { testMultilineBlocks } from './testEngine'

const props = defineProps({
  source: { type: Object, required: true }
})

const open = ref(false)
const activeTab = ref('text')
const logText = ref('')
const testResult = ref(null)
const uploadedFile = ref(null)
const fileProcessing = ref(false)

function runTextTest() {
  testResult.value = testMultilineBlocks(props.source, logText.value)
}

function handleFileSelect(event) {
  const file = event.target.files[0]
  if (file) uploadedFile.value = { name: file.name, size: file.size, file }
  event.target.value = ''
}

function handleFileDrop(event) {
  const file = event.dataTransfer.files[0]
  if (file) uploadedFile.value = { name: file.name, size: file.size, file }
}

async function runFileTest() {
  if (!uploadedFile.value) return
  fileProcessing.value = true
  try {
    const content = await uploadedFile.value.file.text()
    testResult.value = testMultilineBlocks(props.source, content)
  } finally {
    fileProcessing.value = false
  }
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function terminatedLabel(t) {
  const map = { endPattern: '종료 패턴 매칭', count: '라인 수 도달', startPattern: '새 시작 패턴', emptyLine: '빈 줄', eof: '파일 끝' }
  return map[t] || t
}

</script>

<style scoped>
.form-input {
  @apply w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-700 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-500 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition disabled:opacity-60 disabled:cursor-not-allowed;
}
</style>
