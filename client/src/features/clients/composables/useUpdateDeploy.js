import { ref } from 'vue'
import { fetchSSEStream } from '@/shared/utils/sseStreamParser'

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
      await fetchSSEStream(
        '/clients/update/deploy',
        { agentGroup, packageIds, targetEqpIds },
        {
          onMessage: (data) => {
            progress.value.push(data)
            if (onProgress) onProgress(data)
          },
          onDone: (data) => {
            result.value = data
          },
          signal: abortController.signal
        }
      )
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
