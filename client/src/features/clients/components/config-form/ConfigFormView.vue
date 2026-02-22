<template>
  <div class="h-full overflow-y-auto">
    <!-- Parse Error -->
    <div v-if="parseError" class="flex flex-col items-center justify-center h-full p-8 text-center">
      <svg class="w-10 h-10 text-red-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      <p class="text-sm text-red-600 dark:text-red-400 font-medium mb-1">JSON 파싱 오류</p>
      <p class="text-xs text-gray-500 dark:text-gray-400">{{ parseError }}</p>
      <p class="text-xs text-gray-400 dark:text-gray-500 mt-2">JSON View로 전환하여 문법 오류를 수정해주세요.</p>
    </div>

    <!-- Form Content -->
    <div v-else class="p-4">
      <KeepAlive>
        <AccessLogForm
          v-if="fileType === 'accesslog'"
          :modelValue="formDataByType.accesslog"
          :readOnly="readOnly"
          :eqpId="eqpId"
          :agentGroup="agentGroup"
          :agentVersion="agentVersion"
          @update:modelValue="handleFormChange"
        />
        <TriggerForm
          v-else-if="fileType === 'trigger'"
          :modelValue="formDataByType.trigger"
          :readOnly="readOnly"
          :accessLogSources="accessLogSources"
          @update:modelValue="handleFormChange"
        />
        <ARSAgentForm
          v-else-if="fileType === 'arsagent'"
          :modelValue="formDataByType.arsagent"
          :readOnly="readOnly"
          :accessLogSources="accessLogSources"
          :triggerNames="triggerNames"
          :triggerSourceMap="triggerSourceMap"
          :suspendableTriggerNames="suspendableTriggerNames"
          @update:modelValue="handleFormChange"
        />
      </KeepAlive>
    </div>
  </div>
</template>

<script setup>
import { reactive, computed, watch, nextTick } from 'vue'
import { detectConfigFileType } from './shared/configDetection'
import AccessLogForm from './accesslog/AccessLogForm.vue'
import TriggerForm from './trigger/TriggerForm.vue'
import ARSAgentForm from './arsagent/ARSAgentForm.vue'

const props = defineProps({
  content: { type: String, default: '' },
  fileName: { type: String, default: '' },
  filePath: { type: String, default: '' },
  readOnly: { type: Boolean, default: false },
  allContents: { type: Object, default: () => ({}) },
  configFiles: { type: Array, default: () => [] },
  eqpId: { type: String, default: '' },
  agentGroup: { type: String, default: '' },
  agentVersion: { type: String, default: '' }
})

const emit = defineEmits(['update:content'])

const formDataByType = reactive({
  accesslog: {},
  trigger: {},
  arsagent: {}
})
const parseErrorByType = reactive({})
const parseError = computed(() => parseErrorByType[fileType.value] ?? null)
let isInternalUpdate = false
const contentCache = {}

const fileType = computed(() => detectConfigFileType(props.fileName, props.filePath))

// 다른 파일에서 소스명/트리거명 추출
const accessLogSources = computed(() => {
  const accessLogFile = props.configFiles.find(f => detectConfigFileType(f.name, f.path) === 'accesslog')
  if (!accessLogFile) return []
  const content = props.allContents[accessLogFile.fileId]
  if (!content) return []
  try { return Object.keys(JSON.parse(content)) } catch { return [] }
})

const triggerNames = computed(() => {
  const triggerFile = props.configFiles.find(f => detectConfigFileType(f.name, f.path) === 'trigger')
  if (!triggerFile) return []
  const content = props.allContents[triggerFile.fileId]
  if (!content) return []
  try { return Object.keys(JSON.parse(content)) } catch { return [] }
})

const triggerSourceMap = computed(() => {
  const triggerFile = props.configFiles.find(f => detectConfigFileType(f.name, f.path) === 'trigger')
  if (!triggerFile) return {}
  const content = props.allContents[triggerFile.fileId]
  if (!content) return {}
  try {
    const parsed = JSON.parse(content)
    const map = {}
    for (const [name, config] of Object.entries(parsed)) {
      map[name] = (config.source || '').split(',').map(s => s.trim()).filter(Boolean)
    }
    return map
  } catch { return {} }
})

const suspendableTriggerNames = computed(() => {
  const triggerFile = props.configFiles.find(f => detectConfigFileType(f.name, f.path) === 'trigger')
  if (!triggerFile) return []
  const content = props.allContents[triggerFile.fileId]
  if (!content) return []
  try {
    const parsed = JSON.parse(content)
    return Object.entries(parsed)
      .filter(([, config]) => {
        const recipe = config.recipe || []
        return !recipe.some(s => s.next === '@suspend' || s.next === '@resume')
      })
      .map(([name]) => name)
  } catch { return [] }
})

// JSON string → formData 파싱 (타입별 독립 데이터)
watch([() => props.content, fileType], ([newContent, type]) => {
  if (isInternalUpdate || !type) return
  if (newContent === contentCache[type]) return
  contentCache[type] = newContent
  if (!newContent || !newContent.trim()) {
    formDataByType[type] = {}
    parseErrorByType[type] = null
    return
  }
  try {
    formDataByType[type] = JSON.parse(newContent)
    parseErrorByType[type] = null
  } catch (e) {
    parseErrorByType[type] = e.message
  }
}, { immediate: true })

// formData → JSON string 직렬화
function handleFormChange(newData) {
  isInternalUpdate = true
  const type = fileType.value
  formDataByType[type] = newData
  const json = JSON.stringify(newData, null, 2) + '\n'
  contentCache[type] = json
  emit('update:content', json)
  nextTick(() => { isInternalUpdate = false })
}
</script>
