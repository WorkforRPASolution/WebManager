<template>
  <div class="border-t border-gray-200 dark:border-dark-border">
    <!-- Toggle Header -->
    <button
      type="button"
      class="w-full flex items-center gap-2 px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-dark-bg transition"
      @click="open = !open"
    >
      <svg class="w-3.5 h-3.5 transition-transform" :class="{ 'rotate-90': open }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
      </svg>
      경로 매칭 테스트
    </button>

    <div v-show="open" class="px-4 pb-4 space-y-3">
      <!-- Local Test -->
      <div class="space-y-2">
        <label class="text-xs font-medium text-gray-600 dark:text-gray-400">로컬 경로 매칭 테스트</label>
        <div class="flex gap-2">
          <input
            v-model="testPath"
            type="text"
            placeholder="파일 절대경로 입력 (예: D:\Testlog\TestLog_20260214.log)"
            class="flex-1 form-input"
            @keydown.enter="runTest"
          />
          <button
            type="button"
            class="px-3 py-1.5 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-lg transition whitespace-nowrap"
            :disabled="!testPath.trim()"
            @click="runTest"
          >
            테스트
          </button>
        </div>
      </div>

      <!-- Local Result -->
      <div v-if="result" class="rounded-lg p-3 text-sm" :class="result.matched ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50' : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50'">
        <div class="font-medium mb-2" :class="result.matched ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'">
          {{ result.matched ? '✅ 대상 파일입니다' : '❌ 비대상 파일입니다' }}
        </div>
        <div class="space-y-1">
          <div v-for="(step, i) in result.steps" :key="i" class="flex items-start gap-1.5 text-xs">
            <span :class="step.passed ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'">
              {{ step.passed ? '✓' : '✗' }}
            </span>
            <span class="text-gray-600 dark:text-gray-400">
              <span class="font-medium">{{ step.label }}:</span> {{ step.detail }}
            </span>
          </div>
        </div>
      </div>

      <!-- Remote Test -->
      <div v-if="eqpId" class="space-y-2 pt-2 border-t border-gray-100 dark:border-dark-border">
        <div class="flex items-center justify-between">
          <label class="text-xs font-medium text-gray-600 dark:text-gray-400">원격 파일 확인</label>
          <button
            type="button"
            class="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-teal-500 hover:bg-teal-600 rounded-lg transition"
            :disabled="remoteLoading || !source.directory"
            @click="runRemoteTest"
          >
            <svg v-if="remoteLoading" class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <svg v-else class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" />
            </svg>
            {{ remoteLoading ? '확인 중...' : '원격 확인' }}
          </button>
        </div>

        <!-- Remote Error -->
        <div v-if="remoteError" class="rounded-lg p-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50">
          {{ remoteError }}
        </div>

        <!-- Remote Result -->
        <div v-if="remoteResult" class="space-y-2">
          <div class="text-xs text-gray-500 dark:text-gray-400">
            전체 {{ remoteResult.total }}개 파일 중 {{ remoteResult.matched }}개 매칭
          </div>
          <div v-if="remoteResult.files.length > 0" class="max-h-48 overflow-y-auto border border-gray-200 dark:border-dark-border rounded-lg">
            <table class="w-full text-xs">
              <thead class="bg-gray-50 dark:bg-dark-bg sticky top-0">
                <tr>
                  <th class="text-left px-3 py-1.5 font-medium text-gray-500 dark:text-gray-400">파일명</th>
                  <th class="text-right px-3 py-1.5 font-medium text-gray-500 dark:text-gray-400">크기</th>
                  <th class="text-right px-3 py-1.5 font-medium text-gray-500 dark:text-gray-400">수정일</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(file, fi) in remoteResult.files" :key="fi" class="border-t border-gray-100 dark:border-dark-border">
                  <td class="px-3 py-1.5 text-gray-700 dark:text-gray-300 font-mono">
                    {{ file.subdir ? file.subdir + '/' : '' }}{{ file.name }}
                  </td>
                  <td class="px-3 py-1.5 text-right text-gray-500 dark:text-gray-400">{{ formatSize(file.size) }}</td>
                  <td class="px-3 py-1.5 text-right text-gray-500 dark:text-gray-400">{{ formatDate(file.modifiedAt) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else class="text-xs text-gray-400 dark:text-gray-500 text-center py-2">
            매칭되는 파일이 없습니다.
          </div>
        </div>
      </div>
    </div>

    <!-- Log Time Filter Test (conditional) -->
    <LogTimeTestSection v-if="showLogTime" :source="source" />

    <!-- Line Group Test (conditional) -->
    <LineGroupTestSection v-if="showLineGroup" :source="source" />

    <!-- Multiline Block Test (conditional) -->
    <MultilineTestSection v-if="showMultiline" :source="source" />

    <!-- Extract-Append Test (conditional) -->
    <ExtractAppendTestSection v-if="showExtractAppend" :source="source" />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { testAccessLogPath } from './testEngine'
import { decomposeLogType } from './schema'
import { configTestApi } from '../../../api'
import LogTimeTestSection from './LogTimeTestSection.vue'
import LineGroupTestSection from './LineGroupTestSection.vue'
import MultilineTestSection from './MultilineTestSection.vue'
import ExtractAppendTestSection from './ExtractAppendTestSection.vue'

const props = defineProps({
  source: { type: Object, required: true },
  eqpId: { type: String, default: '' },
  agentGroup: { type: String, default: '' }
})

const open = ref(false)
const testPath = ref('')
const result = ref(null)
const remoteLoading = ref(false)
const remoteResult = ref(null)
const remoteError = ref(null)

const showMultiline = computed(() => {
  const axes = decomposeLogType(props.source?.log_type)
  return axes.lineAxis === 'multiline'
})

const showExtractAppend = computed(() => {
  const axes = decomposeLogType(props.source?.log_type)
  return axes.postProc === 'extract_append'
})

const showLogTime = computed(() => {
  return !props.source?._omit_log_time && !!props.source?.log_time_pattern
})

const showLineGroup = computed(() => {
  return !props.source?._omit_line_group && props.source?.line_group_count != null
})

function runTest() {
  if (!testPath.value.trim()) return
  result.value = testAccessLogPath(props.source, testPath.value.trim())
}

async function runRemoteTest() {
  remoteLoading.value = true
  remoteError.value = null
  remoteResult.value = null
  try {
    const res = await configTestApi.testAccessLog(props.eqpId, {
      directory: props.source.directory,
      prefix: props.source.prefix,
      wildcard: props.source.wildcard,
      suffix: props.source.suffix,
      exclude_suffix: props.source.exclude_suffix,
      date_subdir_format: props.source.date_subdir_format
    }, props.agentGroup)
    remoteResult.value = res.data
  } catch (err) {
    remoteError.value = err.response?.data?.error || err.message || '원격 확인 실패'
  } finally {
    remoteLoading.value = false
  }
}

function formatSize(bytes) {
  if (!bytes) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(isoStr) {
  if (!isoStr) return '-'
  try {
    return new Date(isoStr).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  } catch { return '-' }
}
</script>

<style scoped>
@import '../shared/form-input.css';
</style>
