<template>
  <div ref="containerRef" class="monaco-editor-container"></div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, shallowRef } from 'vue'
import * as monaco from 'monaco-editor'

// Monaco Editor 워커 설정
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker'

self.MonacoEnvironment = {
  getWorker(_, label) {
    if (label === 'json') {
      return new jsonWorker()
    }
    if (label === 'html' || label === 'handlebars' || label === 'razor') {
      return new htmlWorker()
    }
    if (label === 'css' || label === 'scss' || label === 'less') {
      return new cssWorker()
    }
    return new editorWorker()
  }
}

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  language: {
    type: String,
    default: 'html'
  },
  theme: {
    type: String,
    default: 'vs' // 'vs' | 'vs-dark'
  },
  readOnly: {
    type: Boolean,
    default: false
  },
  options: {
    type: Object,
    default: () => ({})
  }
})

const emit = defineEmits(['update:modelValue'])

const containerRef = ref(null)
const editor = shallowRef(null)
let isUpdatingFromProps = false

// 에디터 생성
onMounted(() => {
  if (!containerRef.value) return

  const defaultOptions = {
    value: props.modelValue,
    language: props.language,
    theme: props.theme,
    readOnly: props.readOnly,
    automaticLayout: true,
    minimap: { enabled: false },
    fontSize: 14,
    lineNumbers: 'on',
    wordWrap: 'on',
    scrollBeyondLastLine: false,
    tabSize: 2,
    insertSpaces: true,
    formatOnPaste: true,
    formatOnType: true,
    autoClosingBrackets: 'always',
    autoClosingQuotes: 'always',
    folding: true,
    foldingStrategy: 'indentation',
    renderWhitespace: 'selection',
    bracketPairColorization: { enabled: true },
    quickSuggestions: true,
    suggestOnTriggerCharacters: true,
    acceptSuggestionOnEnter: 'on',
    ...props.options
  }

  editor.value = monaco.editor.create(containerRef.value, defaultOptions)

  // 내용 변경 이벤트
  editor.value.onDidChangeModelContent(() => {
    if (isUpdatingFromProps) return
    const value = editor.value.getValue()
    emit('update:modelValue', value)
  })
})

// 외부에서 modelValue 변경 시 에디터 업데이트
watch(() => props.modelValue, (newValue) => {
  if (!editor.value) return
  const currentValue = editor.value.getValue()
  if (newValue !== currentValue) {
    isUpdatingFromProps = true
    editor.value.setValue(newValue || '')
    isUpdatingFromProps = false
  }
})

// 테마 변경 감지
watch(() => props.theme, (newTheme) => {
  monaco.editor.setTheme(newTheme)
})

// 언어 변경 감지
watch(() => props.language, (newLanguage) => {
  if (!editor.value) return
  const model = editor.value.getModel()
  if (model) {
    monaco.editor.setModelLanguage(model, newLanguage)
  }
})

// 읽기 전용 상태 변경
watch(() => props.readOnly, (newReadOnly) => {
  if (!editor.value) return
  editor.value.updateOptions({ readOnly: newReadOnly })
})

// 에디터 정리
onUnmounted(() => {
  if (editor.value) {
    editor.value.dispose()
    editor.value = null
  }
})

// 외부에서 에디터 인스턴스에 접근할 수 있도록 expose
defineExpose({
  getEditor: () => editor.value,
  focus: () => editor.value?.focus(),
  format: () => editor.value?.getAction('editor.action.formatDocument')?.run()
})
</script>

<style scoped>
.monaco-editor-container {
  width: 100%;
  height: 100%;
  min-height: 200px;
}
</style>
