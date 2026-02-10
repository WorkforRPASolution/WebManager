<template>
  <div ref="containerRef" class="monaco-diff-editor-container"></div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, shallowRef } from 'vue'
import * as monaco from 'monaco-editor'

const emit = defineEmits(['update:modelValue'])

const props = defineProps({
  original: {
    type: String,
    default: ''
  },
  modified: {
    type: String,
    default: ''
  },
  language: {
    type: String,
    default: 'json'
  },
  theme: {
    type: String,
    default: 'vs'
  },
  readOnly: {
    type: Boolean,
    default: true
  },
  options: {
    type: Object,
    default: () => ({})
  }
})

const containerRef = ref(null)
const diffEditor = shallowRef(null)

onMounted(() => {
  if (!containerRef.value) return

  const defaultOptions = {
    automaticLayout: true,
    readOnly: props.readOnly,
    renderSideBySide: true,
    minimap: { enabled: false },
    fontSize: 14,
    scrollBeyondLastLine: false,
    ...props.options
  }

  diffEditor.value = monaco.editor.createDiffEditor(containerRef.value, defaultOptions)

  const originalModel = monaco.editor.createModel(props.original, props.language)
  const modifiedModel = monaco.editor.createModel(props.modified, props.language)

  diffEditor.value.setModel({
    original: originalModel,
    modified: modifiedModel
  })

  const modifiedEditor = diffEditor.value.getModifiedEditor()
  modifiedEditor.onDidChangeModelContent(() => {
    emit('update:modelValue', modifiedEditor.getValue())
  })

  monaco.editor.setTheme(props.theme)
})

watch(() => props.original, (newVal) => {
  if (!diffEditor.value) return
  const model = diffEditor.value.getModel()
  if (model?.original) {
    model.original.setValue(newVal || '')
  }
})

watch(() => props.modified, (newVal) => {
  if (!diffEditor.value) return
  const model = diffEditor.value.getModel()
  if (model?.modified) {
    model.modified.setValue(newVal || '')
  }
})

watch(() => props.theme, (newTheme) => {
  monaco.editor.setTheme(newTheme)
})

watch(() => props.language, (newLanguage) => {
  if (!diffEditor.value) return
  const model = diffEditor.value.getModel()
  if (model?.original) {
    monaco.editor.setModelLanguage(model.original, newLanguage)
  }
  if (model?.modified) {
    monaco.editor.setModelLanguage(model.modified, newLanguage)
  }
})

onUnmounted(() => {
  if (diffEditor.value) {
    const model = diffEditor.value.getModel()
    if (model?.original) model.original.dispose()
    if (model?.modified) model.modified.dispose()
    diffEditor.value.dispose()
    diffEditor.value = null
  }
})

defineExpose({
  getEditor: () => diffEditor.value
})
</script>

<style scoped>
.monaco-diff-editor-container {
  width: 100%;
  height: 100%;
  min-height: 200px;
}
</style>
