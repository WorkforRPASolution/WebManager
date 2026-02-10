import { ref } from 'vue'

export function useLogSearch() {
  const searchQuery = ref('')
  const isRegex = ref(false)
  const searchResults = ref([])
  const searching = ref(false)
  const searchError = ref(null)

  /**
   * Search across all downloaded files in clientCache
   * @param {Object} clientCache - The clientCache ref value
   * @param {Array} selectedClients - Selected client objects
   */
  function searchAll(clientCache, selectedClients) {
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
      
      for (const client of selectedClients) {
        const eqpId = client.eqpId || client.id
        const cache = clientCache[eqpId]
        if (!cache) continue
        
        for (const [filePath, content] of Object.entries(cache.contents || {})) {
          if (!content) continue
          
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
              const tab = cache.openTabs?.find(t => t.filePath === filePath)
              results.push({
                eqpId,
                clientName: client.name || eqpId,
                fileName: tab?.fileName || filePath.split('/').pop(),
                filePath,
                lineNum: i + 1,
                lineContent: line.length > 200 ? line.substring(0, 200) + '...' : line
              })
            }
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
