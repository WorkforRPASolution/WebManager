<script setup>
import { ref, watch, onMounted, onActivated } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { TOC, findSection } from './toc'
import HelpLayout from './components/HelpLayout.vue'

const route = useRoute()
const router = useRouter()

const currentSectionId = ref('')

function syncFromHash() {
  const hash = route.hash?.replace('#', '') || ''
  if (hash && findSection(hash)) {
    currentSectionId.value = hash
  } else if (!currentSectionId.value && TOC.length > 0 && TOC[0].sections.length > 0) {
    currentSectionId.value = TOC[0].sections[0].id
  }
}

watch(() => route.hash, syncFromHash)
onMounted(syncFromHash)
onActivated(syncFromHash)

function navigateToSection(sectionId) {
  currentSectionId.value = sectionId
  router.replace({ path: '/help', hash: `#${sectionId}` })
}
</script>

<template>
  <HelpLayout
    :currentSectionId="currentSectionId"
    @navigate="navigateToSection"
  />
</template>
