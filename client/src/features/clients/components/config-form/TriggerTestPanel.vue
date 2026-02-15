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
      패턴 매칭 테스트
    </button>

    <div v-show="open" class="px-4 pb-4 space-y-4">
      <!-- Tab buttons -->
      <div class="flex gap-1 border-b border-gray-200 dark:border-dark-border">
        <button
          type="button"
          class="px-3 py-1.5 text-xs font-medium border-b-2 transition"
          :class="activeTab === 'text' ? 'border-primary-500 text-primary-600 dark:text-primary-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'"
          @click="activeTab = 'text'"
        >
          텍스트 입력
        </button>
        <button
          type="button"
          class="px-3 py-1.5 text-xs font-medium border-b-2 transition"
          :class="activeTab === 'file' ? 'border-primary-500 text-primary-600 dark:text-primary-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'"
          @click="activeTab = 'file'"
        >
          파일 시뮬레이션
        </button>
      </div>

      <!-- Timestamp Format (shared between tabs) -->
      <div class="space-y-1.5">
        <label class="text-xs font-medium text-gray-600 dark:text-gray-400">Timestamp Format (선택)</label>
        <div class="flex gap-2">
          <select v-model="tsPreset" class="flex-1 form-input text-xs" @change="onPresetChange">
            <option value="">포맷 미사용 (duration 체크 건너뜀)</option>
            <option value="yyyy-MM-dd HH:mm:ss">yyyy-MM-dd HH:mm:ss</option>
            <option value="yyyy-MM-dd HH:mm:ss.SSS">yyyy-MM-dd HH:mm:ss.SSS</option>
            <option value="yyyy/MM/dd HH:mm:ss">yyyy/MM/dd HH:mm:ss</option>
            <option value="custom">Custom...</option>
          </select>
          <input
            v-if="tsPreset === 'custom'"
            v-model="customTsFormat"
            type="text"
            placeholder="예: [yyyy-MM-dd HH:mm:ss]"
            class="flex-1 form-input text-xs"
          />
        </div>
      </div>

      <!-- Text Tab -->
      <div v-if="activeTab === 'text'" class="space-y-3">
        <textarea
          v-model="logText"
          rows="6"
          placeholder="로그 텍스트를 입력하세요 (줄 단위)&#10;예:&#10;2026-02-14 10:23:45 ERROR connection failed&#10;2026-02-14 10:24:12 ERROR timeout"
          class="w-full px-3 py-2 text-xs font-mono border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-700 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition resize-y"
        ></textarea>
        <button
          type="button"
          class="px-3 py-1.5 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-lg transition"
          :disabled="!logText.trim()"
          @click="runTextTest"
        >
          테스트
        </button>
      </div>

      <!-- File Tab -->
      <div v-if="activeTab === 'file'" class="space-y-3">
        <div
          class="border-2 border-dashed border-gray-300 dark:border-dark-border rounded-lg p-4 text-center cursor-pointer hover:border-primary-400 transition"
          @click="$refs.fileInput.click()"
          @dragover.prevent
          @drop.prevent="handleFileDrop"
        >
          <input ref="fileInput" type="file" multiple accept=".log,.txt,.csv" class="hidden" @change="handleFileSelect" />
          <svg class="w-8 h-8 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <p class="text-xs text-gray-500 dark:text-gray-400">클릭하거나 파일을 드래그&드롭하세요 (.log, .txt, .csv)</p>
        </div>

        <!-- File list -->
        <div v-if="uploadedFiles.length > 0" class="space-y-1">
          <div v-for="(file, fi) in uploadedFiles" :key="fi" class="flex items-center justify-between px-2 py-1 text-xs bg-gray-50 dark:bg-dark-bg rounded">
            <span class="text-gray-700 dark:text-gray-300">{{ file.name }} <span class="text-gray-400">({{ formatFileSize(file.size) }})</span></span>
            <button type="button" class="text-gray-400 hover:text-red-500 transition" @click="removeFile(fi)">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <button
          type="button"
          class="px-3 py-1.5 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-lg transition"
          :disabled="uploadedFiles.length === 0 || fileProcessing"
          @click="runFileTest"
        >
          {{ fileProcessing ? '처리 중...' : '시뮬레이션 실행' }}
        </button>
      </div>

      <!-- Results -->
      <div v-if="testResult" class="space-y-3">
        <!-- File summary (if file mode) -->
        <div v-if="fileSummary" class="text-xs text-gray-500 dark:text-gray-400">
          {{ fileSummary }}
        </div>

        <!-- Step results -->
        <div v-for="(step, si) in testResult.steps" :key="si" class="rounded-lg p-3 text-xs border" :class="step.fired ? 'bg-green-50/50 dark:bg-green-900/10 border-green-200 dark:border-green-800/50' : 'bg-gray-50 dark:bg-dark-bg border-gray-200 dark:border-dark-border'">
          <div class="flex items-center gap-2 mb-2">
            <span class="font-medium text-gray-700 dark:text-gray-300">
              {{ step.name }} ({{ step.type }}{{ step.required.duration ? ', ' + step.required.duration : '' }}):
            </span>
            <span class="font-medium" :class="step.fired ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'">
              {{ step.matchCount }}/{{ step.required.times }}회 매칭
              {{ step.fired ? '→ 발동 ✅' : '→ 미발동 ⏳' }}
            </span>
            <span v-if="step.fired && step.nextAction" class="text-primary-600 dark:text-primary-400">{{ step.nextAction }}</span>
          </div>

          <!-- Duration check -->
          <div v-if="step.durationCheck" class="mb-2 text-xs" :class="step.durationCheck.passed ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'">
            <template v-if="step.durationCheck.elapsed">
              (경과: {{ step.durationCheck.elapsed }} {{ step.durationCheck.passed ? '≤' : '>' }} {{ step.durationCheck.limit }})
            </template>
            <template v-else-if="step.durationCheck.message">
              {{ step.durationCheck.message }}
            </template>
          </div>

          <!-- Matched lines -->
          <div v-if="step.matches.length > 0" class="space-y-0.5 font-mono">
            <div v-for="(m, mi) in step.matches" :key="mi" class="text-gray-600 dark:text-gray-400 flex gap-2">
              <span class="text-gray-400 shrink-0">
                {{ m.fileName ? `${m.fileName}:${m.lineNum}` : `Line ${m.lineNum}` }}
              </span>
              <span class="truncate">"{{ m.line }}"</span>
              <span class="text-primary-500 shrink-0">← {{ m.pattern }}</span>
            </div>
          </div>
        </div>

        <!-- Final result -->
        <div class="rounded-lg p-3 text-sm font-medium" :class="testResult.finalResult.triggered ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'">
          {{ testResult.finalResult.triggered ? '✅' : '⏳' }} {{ testResult.finalResult.message }}
        </div>
      </div>

      <!-- Error -->
      <div v-if="testError" class="rounded-lg p-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50">
        {{ testError }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { testTriggerPattern, testTriggerWithFiles } from './configTestEngine'

const props = defineProps({
  trigger: { type: Object, required: true }
})

const open = ref(false)
const activeTab = ref('text')
const logText = ref('')
const tsPreset = ref('')
const customTsFormat = ref('')
const testResult = ref(null)
const testError = ref(null)
const uploadedFiles = ref([])
const fileProcessing = ref(false)
const fileSummary = ref(null)

const timestampFormat = computed(() => {
  if (tsPreset.value === 'custom') return customTsFormat.value || null
  return tsPreset.value || null
})

function onPresetChange() {
  if (tsPreset.value !== 'custom') {
    customTsFormat.value = ''
  }
}

function runTextTest() {
  testError.value = null
  fileSummary.value = null
  try {
    testResult.value = testTriggerPattern(props.trigger, logText.value, timestampFormat.value)
  } catch (e) {
    testError.value = `테스트 오류: ${e.message}`
    testResult.value = null
  }
}

function handleFileSelect(event) {
  addFiles(Array.from(event.target.files))
  event.target.value = ''
}

function handleFileDrop(event) {
  addFiles(Array.from(event.dataTransfer.files))
}

function addFiles(files) {
  for (const file of files) {
    uploadedFiles.value.push({
      name: file.name,
      size: file.size,
      file
    })
  }
}

function removeFile(index) {
  uploadedFiles.value.splice(index, 1)
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

async function runFileTest() {
  testError.value = null
  fileProcessing.value = true
  try {
    const fileContents = []
    for (const f of uploadedFiles.value) {
      const content = await f.file.text()
      fileContents.push({ name: f.name, content })
    }

    const totalLines = fileContents.reduce((sum, f) => sum + f.content.split('\n').length, 0)
    fileSummary.value = `📁 ${fileContents.length}개 파일, 총 ${totalLines.toLocaleString()}줄 처리`

    testResult.value = testTriggerWithFiles(props.trigger, fileContents, timestampFormat.value)
  } catch (e) {
    testError.value = `시뮬레이션 오류: ${e.message}`
    testResult.value = null
  } finally {
    fileProcessing.value = false
  }
}
</script>

<style scoped>
.form-input {
  @apply w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-bg text-gray-700 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition disabled:opacity-60 disabled:cursor-not-allowed;
}
</style>
