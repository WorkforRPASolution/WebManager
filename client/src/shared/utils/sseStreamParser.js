/**
 * SSE Stream Parser utility
 *
 * Shared fetch + ReadableStream + SSE line parsing for all SSE consumers.
 * Replaces duplicated patterns in useBatchActionStream, useUpdateDeploy,
 * ConfigRolloutPanel, and useLogTailStream.
 */

const API_BASE = import.meta.env.VITE_API_URL || '/api'

/**
 * Make an authenticated SSE POST request and parse the event stream.
 *
 * @param {string} url - API path (e.g., '/clients/update/deploy'). Relative paths are prefixed with API_BASE.
 * @param {object} body - POST body (will be JSON.stringify'd)
 * @param {object} options
 * @param {function} options.onMessage - Called for each parsed SSE data event (excluding done)
 * @param {function} [options.onDone] - Called when server sends { done: true, ... }
 * @param {AbortSignal} [options.signal] - AbortController signal for cancellation
 * @returns {Promise<void>}
 */
export async function fetchSSEStream(url, body, { onMessage, onDone, signal } = {}) {
  const token = localStorage.getItem('token')
  const fullUrl = url.startsWith('http') ? url : `${API_BASE}${url}`

  const response = await fetch(fullUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body),
    signal
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    if (signal?.aborted) break
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
            if (onDone) onDone(data)
            return
          }
          if (onMessage) onMessage(data)
        } catch {
          // skip malformed JSON
        }
      }
    }
  }
}
