import { ref } from 'vue'
import { serviceApi } from '../api'

export function useBatchActionStream() {
  const streaming = ref(false)
  let abortController = null

  async function execute(action, eqpIds, agentGroup, onResult) {
    if (abortController) {
      abortController.abort()
    }
    abortController = new AbortController()
    streaming.value = true

    try {
      const response = await serviceApi.batchActionStream(action, eqpIds, agentGroup)
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
                break
              }
              onResult(data)
            } catch (e) {
              // skip malformed JSON
            }
          }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') throw err
    } finally {
      streaming.value = false
      abortController = null
    }
  }

  function cancel() {
    if (abortController) {
      abortController.abort()
      abortController = null
      streaming.value = false
    }
  }

  return { streaming, execute, cancel }
}
