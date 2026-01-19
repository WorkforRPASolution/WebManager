import { ref, onMounted } from 'vue'

export function useFilterBookmarks(pageKey) {
  const bookmarks = ref([])
  const STORAGE_KEY = `filterBookmarks_${pageKey}`

  const load = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      bookmarks.value = saved ? JSON.parse(saved) : []
    } catch (error) {
      console.error('Failed to load bookmarks:', error)
      bookmarks.value = []
    }
  }

  const persist = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks.value))
    } catch (error) {
      console.error('Failed to save bookmarks:', error)
    }
  }

  const add = (name, filters) => {
    bookmarks.value.push({
      id: `bm_${Date.now()}`,
      name,
      filters: JSON.parse(JSON.stringify(filters)),
      createdAt: new Date().toISOString()
    })
    persist()
  }

  const remove = (id) => {
    const index = bookmarks.value.findIndex(b => b.id === id)
    if (index !== -1) {
      bookmarks.value.splice(index, 1)
      persist()
    }
  }

  const rename = (id, newName) => {
    const bookmark = bookmarks.value.find(b => b.id === id)
    if (bookmark) {
      bookmark.name = newName
      persist()
    }
  }

  onMounted(load)

  return { bookmarks, add, remove, rename }
}
