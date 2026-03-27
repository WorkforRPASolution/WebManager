<script setup>
import { ref } from 'vue'
import { TOC } from '../toc'
import AppIcon from '../../../shared/components/AppIcon.vue'

const props = defineProps({
  currentSectionId: { type: String, default: '' }
})

const emit = defineEmits(['navigate'])

// 챕터 접기/펼치기 상태 (기본: 모두 펼침)
const expandedChapters = ref(
  Object.fromEntries(TOC.map(ch => [ch.id, true]))
)

function toggleChapter(chapterId) {
  expandedChapters.value[chapterId] = !expandedChapters.value[chapterId]
}

function isActiveChapter(chapter) {
  return chapter.sections.some(s => s.id === props.currentSectionId)
}
</script>

<template>
  <aside class="w-64 shrink-0 border-r border-gray-200 dark:border-dark-border overflow-y-auto bg-gray-50 dark:bg-dark-bg">
    <nav class="p-4 space-y-1">
      <div v-for="chapter in TOC" :key="chapter.id">
        <!-- Chapter Header -->
        <button
          @click="toggleChapter(chapter.id)"
          class="w-full flex items-center gap-2 px-2 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors"
          :class="isActiveChapter(chapter)
            ? 'text-primary-600 dark:text-primary-400'
            : 'text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'"
        >
          <AppIcon :name="chapter.icon" size="4" />
          <span class="flex-1 text-left">{{ chapter.label }}</span>
          <svg
            class="w-3 h-3 transition-transform"
            :class="{ 'rotate-90': expandedChapters[chapter.id] }"
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
          </svg>
        </button>

        <!-- Section Items -->
        <ul v-show="expandedChapters[chapter.id]" class="ml-4 mt-1 space-y-0.5 mb-2">
          <li v-for="section in chapter.sections" :key="section.id">
            <button
              @click="emit('navigate', section.id)"
              class="w-full text-left px-3 py-1.5 text-sm rounded-lg transition-colors"
              :class="currentSectionId === section.id
                ? 'bg-primary-500 text-white font-medium'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-dark-border hover:text-gray-900 dark:hover:text-gray-200'"
            >
              {{ section.label }}
            </button>
          </li>
        </ul>
      </div>
    </nav>
  </aside>
</template>
