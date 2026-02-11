import { ref } from 'vue'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

export function useUpdateDeploy() {
  const deploying = ref(false)
  const progress = ref([]) // Array of progress events
  const result = ref(null)
  let abortController = null

  async function deploy(agentGroup, packageIds, targetEqpIds, onProgress) {
    if (abortController) {
      abortController.abort()
    }
    abortController = new AbortController()
    deploying.value = true
    progress.value = []
    result.value = null

    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE}/clients/update/deploy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ agentGroup, packageIds, targetEqpIds }),
        signal: abortController.signal
      })

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        if (abortController.signal.aborted) break
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop()

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              if (data.done) {
                result.value = data
                break
              }
              progress.value.push(data)
              if (onProgress) onProgress(data)
            } catch (e) {
              // skip malformed JSON
            }
          }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        result.value = { done: true, error: err.message }
      }
    } finally {
      deploying.value = false
      abortController = null
    }
  }

  function cancel() {
    if (abortController) {
      abortController.abort()
      abortController = null
      deploying.value = false
    }
  }

  function reset() {
    progress.value = []
    result.value = null
  }

  return { deploying, progress, result, deploy, cancel, reset }
}
