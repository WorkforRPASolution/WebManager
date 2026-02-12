import { ref, reactive } from 'vue'
import { makeCompositeKey } from '@/shared/utils/compositeKey'
import { fetchSSEStream } from '@/shared/utils/sseStreamParser'

const MAX_TAIL_BUFFER_LINES = parseInt(import.meta.env.VITE_LOG_TAIL_BUFFER_LINES) || 1000

export function useLogTailStream() {
  const tailing = ref(false)
  const tailBuffers = reactive(new Map())  // key: `${eqpId}:${filePath}` → { lines: [], error: null }
  let abortController = null

  function getBufferKey(eqpId, filePath) {
    return makeCompositeKey(eqpId, filePath)
  }

  async function startTailing(targets) {
    if (abortController) {
      abortController.abort()
    }
    abortController = new AbortController()
    tailing.value = true
    
    // Initialize buffers
    for (const t of targets) {
      const key = getBufferKey(t.eqpId, t.filePath)
      tailBuffers.set(key, { lines: [], error: null, truncated: false })
    }

    try {
      await fetchSSEStream(
        '/clients/log-tail-stream',
        { targets },
        {
          onMessage: (data) => {
            const key = getBufferKey(data.eqpId, data.filePath)
            const buf = tailBuffers.get(key)
            
            if (buf) {
              if (data.error) {
                buf.error = data.error
              } else if (data.lines) {
                buf.lines.push(...data.lines)
                // Trim buffer if too long
                if (buf.lines.length > MAX_TAIL_BUFFER_LINES) {
                  buf.lines = buf.lines.slice(-MAX_TAIL_BUFFER_LINES)
                  buf.truncated = true
                }
                buf.error = null
              }
            }
          },
          signal: abortController.signal
        }
      )
    } catch (err) {
      if (err.name !== 'AbortError') {
        // Set error on all buffers
        for (const [key, buf] of tailBuffers) {
          buf.error = err.message
        }
      }
    } finally {
      tailing.value = false
      abortController = null
    }
  }

  function stopTailing() {
    if (abortController) {
      abortController.abort()
      abortController = null
      tailing.value = false
    }
  }

  function clearBuffer(eqpId, filePath) {
    const key = getBufferKey(eqpId, filePath)
    const buf = tailBuffers.get(key)
    if (buf) {
      buf.lines = []
      buf.truncated = false
      buf.error = null
    }
  }

  function clearAllBuffers() {
    tailBuffers.clear()
  }

  return {
    tailing,
    tailBuffers,
    getBufferKey,
    startTailing,
    stopTailing,
    clearBuffer,
    clearAllBuffers
  }
}
