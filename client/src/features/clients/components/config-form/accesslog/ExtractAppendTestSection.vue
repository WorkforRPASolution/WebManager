<template>
  <div class="border-t border-gray-200 dark:border-dark-border">
    <!-- Toggle Header (orange) -->
    <button
      type="button"
      class="w-full flex items-center gap-2 px-4 py-2 text-xs font-medium text-orange-600 dark:text-orange-400 hover:bg-orange-50/50 dark:hover:bg-orange-900/10 transition"
      @click="open = !open"
    >
      <svg class="w-3.5 h-3.5 transition-transform" :class="{ 'rotate-90': open }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
      </svg>
      추출-삽입 테스트
    </button>

    <div v-show="open" class="px-4 pb-4 space-y-4">
      <!-- Input: File Path -->
      <div class="space-y-1.5">
        <label class="text-xs font-medium text-gray-600 dark:text-gray-400">파일 절대경로 (추출 대상)</label>
        <input
          v-model="filePath"
          type="text"
          placeholder="예: C:\Log\1234\5678\app_log.txt"
          class="w-full form-input"
        />
      </div>

      <!-- Input: Log Text -->
      <div class="space-y-1.5">
        <label class="text-xs font-medium text-gray-600 dark:text-gray-400">로그 텍스트</label>
        <textarea
          v-model="logText"
          rows="4"
          placeholder="변환 대상 로그 텍스트를 입력하세요&#10;예:&#10;ERROR connection failed&#10;WARN timeout occurred"
          class="w-full px-3 py-2 text-xs font-mono border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-700 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-500 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition resize-y"
        ></textarea>
      </div>

      <button
        type="button"
        class="px-3 py-1.5 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 rounded-lg transition"
        :disabled="!filePath.trim() || !logText.trim()"
        @click="runTest"
      >
        테스트
      </button>

      <!-- Results -->
      <div v-if="testResult" class="space-y-3">
        <!-- Step 1: Extraction -->
        <div class="rounded-lg p-3 text-xs border" :class="testResult.extraction.matched ? 'border-orange-200 dark:border-orange-800/50 bg-orange-50/30 dark:bg-orange-900/10' : 'border-red-200 dark:border-red-800/50 bg-red-50/30 dark:bg-red-900/10'">
          <div class="font-medium mb-1.5" :class="testResult.extraction.matched ? 'text-orange-700 dark:text-orange-300' : 'text-red-700 dark:text-red-300'">
            {{ testResult.extraction.matched ? '1. 추출 성공' : '1. 추출 실패' }}
          </div>
          <div class="space-y-1 text-gray-600 dark:text-gray-400">
            <div><span class="text-gray-400">패턴:</span> <span class="font-mono">{{ testResult.extraction.pattern || '(없음)' }}</span></div>
            <div v-if="testResult.extraction.error" class="text-red-600 dark:text-red-400">정규식 오류: {{ testResult.extraction.error }}</div>
            <div v-if="testResult.extraction.matched" class="flex flex-wrap gap-2 mt-1">
              <span
                v-for="(val, gi) in testResult.extraction.groups"
                :key="gi"
                class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300"
              >
                @{{ gi + 1 }}=<strong>{{ val }}</strong>
              </span>
            </div>
          </div>
        </div>

        <!-- Step 2: Format Preview -->
        <div v-if="testResult.extraction.matched" class="rounded-lg p-3 text-xs border border-gray-200 dark:border-dark-border bg-gray-50/50 dark:bg-dark-bg">
          <div class="font-medium mb-1.5 text-gray-700 dark:text-gray-300">2. 포맷 미리보기</div>
          <div class="space-y-1 text-gray-600 dark:text-gray-400">
            <div><span class="text-gray-400">원본:</span> <span class="font-mono">{{ testResult.formatting.appendFormat || '(없음)' }}</span></div>
            <div><span class="text-gray-400">치환:</span> <span class="font-mono font-medium text-orange-600 dark:text-orange-400">{{ testResult.formatting.resolved || '(없음)' }}</span></div>
            <div><span class="text-gray-400">삽입 위치:</span> {{ testResult.formatting.appendPos }} {{ positionLabel(testResult.formatting.appendPos) }}</div>
          </div>
        </div>

        <!-- Step 3: Transformed Lines -->
        <div v-if="testResult.extraction.matched && testResult.formatting.resolved" class="rounded-lg border border-gray-200 dark:border-dark-border overflow-hidden">
          <div class="px-3 py-1.5 bg-gray-50 dark:bg-dark-bg text-xs font-medium text-gray-700 dark:text-gray-300">
            3. 변환 결과 ({{ testResult.summary.totalLines }}줄)
          </div>
          <div class="divide-y divide-gray-100 dark:divide-gray-800">
            <div v-for="line in testResult.lines" :key="line.lineNum" class="px-3 py-1.5 text-xs font-mono">
              <div class="flex gap-2">
                <span class="text-gray-400 shrink-0 w-6 text-right">{{ line.lineNum }}</span>
                <div class="flex-1 min-w-0">
                  <div class="text-gray-400 line-through truncate">{{ line.original }}</div>
                  <div class="text-gray-700 dark:text-gray-300 truncate">{{ line.result }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { testExtractAppend } from './testEngine'

const props = defineProps({
  source: { type: Object, required: true }
})

const open = ref(false)
const filePath = ref('')
const logText = ref('')
const testResult = ref(null)

function runTest() {
  testResult.value = testExtractAppend(props.source, filePath.value.trim(), logText.value)
}

function positionLabel(pos) {
  if (pos <= 0) return '(앞에 붙임)'
  return `(${pos}번째 문자 뒤 삽입)`
}
</script>

<style scoped>
.form-input {
  @apply w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-700 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-500 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition disabled:opacity-60 disabled:cursor-not-allowed;
}
</style>
