<script setup>
import { computed, ref, watch, nextTick, defineAsyncComponent } from 'vue'
import { TOC, findSection, getAdjacentSections } from '../toc'
import HelpSidebar from './HelpSidebar.vue'
import HelpSearchBar from './HelpSearchBar.vue'
import HelpBreadcrumb from './HelpBreadcrumb.vue'
import '../styles/help.css'

const props = defineProps({
  currentSectionId: { type: String, default: '' }
})

const emit = defineEmits(['navigate'])

const contentRef = ref(null)

const currentSection = computed(() => findSection(props.currentSectionId))
const adjacent = computed(() => getAdjacentSections(props.currentSectionId))

// Dynamic async component — defineAsyncComponent wraps the lazy import
const currentComponent = computed(() => {
  if (!currentSection.value?.component) return null
  return defineAsyncComponent(currentSection.value.component)
})

// 섹션 변경 시 콘텐츠 영역 스크롤 초기화
watch(() => props.currentSectionId, async () => {
  await nextTick()
  if (contentRef.value) {
    contentRef.value.scrollTop = 0
  }
})

function handleNavigate(sectionId) {
  emit('navigate', sectionId)
}
</script>

<template>
  <div class="flex flex-col" style="height: calc(100vh - 144px)">
    <!-- Search Bar -->
    <HelpSearchBar @navigate="handleNavigate" />

    <!-- Main Content -->
    <div class="flex flex-1 min-h-0">
      <!-- TOC Sidebar -->
      <HelpSidebar
        :currentSectionId="currentSectionId"
        @navigate="handleNavigate"
      />

      <!-- Content Area -->
      <div ref="contentRef" class="flex-1 overflow-y-auto px-8 py-6">
        <!-- Breadcrumb -->
        <HelpBreadcrumb :sectionId="currentSectionId" class="mb-6" />

        <!-- Dynamic Section Component -->
        <component
          v-if="currentComponent"
          :is="currentComponent"
        />

        <!-- Prev / Next Navigation -->
        <div class="flex justify-between items-center mt-12 pt-6 border-t border-gray-200 dark:border-dark-border">
          <button
            v-if="adjacent.prev"
            @click="handleNavigate(adjacent.prev.id)"
            class="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-primary-500 dark:hover:text-primary-400 transition-colors"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
            </svg>
            <span>{{ adjacent.prev.label }}</span>
          </button>
          <div v-else></div>
          <button
            v-if="adjacent.next"
            @click="handleNavigate(adjacent.next.id)"
            class="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-primary-500 dark:hover:text-primary-400 transition-colors"
          >
            <span>{{ adjacent.next.label }}</span>
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
            </svg>
          </button>
          <div v-else></div>
        </div>
      </div>
    </div>
  </div>
</template>
