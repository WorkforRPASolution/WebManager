/**
 * SSE (Server-Sent Events) helper utility
 *
 * Extracts the repeated SSE setup pattern from controller handlers.
 * IMPORTANT: Uses res.on('close'), NOT req.on('close').
 * req 'close' fires when request body is consumed (immediately for small POST).
 * res 'close' fires when the actual TCP connection drops.
 */

/**
 * Set up SSE response headers and provide send/end helpers.
 * @param {import('express').Response} res - Express response object
 * @returns {{ send: function, end: function, isAborted: function }}
 */
function setupSSE(res) {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  let aborted = false
  res.on('close', () => { aborted = true })

  return {
    /** Send a JSON data event. No-op if client disconnected. */
    send: (data) => {
      if (!aborted) {
        res.write(`data: ${JSON.stringify(data)}\n\n`)
      }
    },
    /** End the response stream. */
    end: () => res.end(),
    /** Check if client has disconnected. */
    isAborted: () => aborted
  }
}

module.exports = { setupSSE }
