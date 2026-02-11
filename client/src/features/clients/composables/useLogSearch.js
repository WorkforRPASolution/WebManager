import { ref } from 'vue'
import { parseCompositeKey } from '@/shared/utils/compositeKey'

export function useLogSearch() {
  const searchQuery = ref('')
  const isRegex = ref(false)
  const searchResults = ref([])
  const searching = ref(false)
  const searchError = ref(null)

  /**
   * Search across all open files using global contents
   * @param {Object} globalContents - The globalContents ref value { 'eqpId:filePath': string }
   * @param {Array} globalOpenTabs - The globalOpenTabs ref value [{ eqpId, filePath, fileName, sourceId }]
   * @param {Array} selectedClients - Selected client objects
   */
  function searchAll(globalContents, globalOpenTabs, selectedClients) {
    if (!searchQuery.value.trim()) {
      searchResults.value = []
      return
    }

    searching.value = true
    searchError.value = null
    const results = []

    try {
      let regex
      if (isRegex.value) {
        regex = new RegExp(searchQuery.value, 'gi')
      }

      for (const [compositeKey, content] of Object.entries(globalContents || {})) {
        if (!content) continue

        const { eqpId, filePath } = parseCompositeKey(compositeKey)

        const client = (selectedClients || []).find(c => (c.eqpId || c.id) === eqpId)
        const tab = (globalOpenTabs || []).find(t => t.eqpId === eqpId && t.filePath === filePath)

        const lines = content.split('\n')
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]
          let match = false

          if (isRegex.value && regex) {
            regex.lastIndex = 0
            match = regex.test(line)
          } else {
            match = line.toLowerCase().includes(searchQuery.value.toLowerCase())
          }

          if (match) {
            results.push({
              eqpId,
              clientName: client?.name || client?.eqpId || eqpId,
              fileName: tab?.fileName || filePath.split('/').pop(),
              filePath,
              lineNum: i + 1,
              lineContent: line.length > 200 ? line.substring(0, 200) + '...' : line
            })
          }
        }
      }

      searchResults.value = results
    } catch (err) {
      searchError.value = err.message
      searchResults.value = []
    } finally {
      searching.value = false
    }
  }

  function clearSearch() {
    searchQuery.value = ''
    searchResults.value = []
    searchError.value = null
  }

  return {
    searchQuery,
    isRegex,
    searchResults,
    searching,
    searchError,
    searchAll,
    clearSearch
  }
}
