import { ref, computed } from 'vue'
import { SECTION_INDEX } from '../toc'

export function useHelpSearch() {
  const query = ref('')
  const isOpen = ref(false)

  const results = computed(() => {
    const q = query.value.trim().toLowerCase()
    if (q.length < 2) return []

    const terms = q.split(/\s+/)

    return SECTION_INDEX.filter(section => {
      const haystack = [
        section.label,
        section.searchText,
        ...(section.keywords || []),
        section.chapterLabel
      ].join(' ').toLowerCase()

      return terms.every(term => haystack.includes(term))
    }).slice(0, 10)
  })

  function clear() {
    query.value = ''
    isOpen.value = false
  }

  return { query, results, isOpen, clear }
}
