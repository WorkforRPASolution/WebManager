import { ref } from 'vue'
import { fetchSSEStream } from '@/shared/utils/sseStreamParser'

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
      await fetchSSEStream(
        `/clients/batch-action-stream/${action}`,
        { eqpIds, agentGroup },
        { onMessage: onResult, signal: abortController.signal }
      )
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
