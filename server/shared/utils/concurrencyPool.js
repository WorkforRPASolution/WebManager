/**
 * Concurrency Pool utility
 *
 * Set-based concurrency limiter for batch async operations.
 * Used by config deploy, update deploy, etc.
 */

/**
 * Run async handlers concurrently with a pool size limit.
 * Each item is passed to the handler. The handler should handle its own errors
 * (try/catch) and progress reporting internally.
 *
 * @param {Array} items - Items to process
 * @param {function} handler - Async function(item) to run for each item
 * @param {number} [concurrency=5] - Max concurrent operations
 * @returns {Promise<void>}
 */
async function runConcurrently(items, handler, concurrency = 5) {
  const pool = new Set()

  for (const item of items) {
    const promise = handler(item)
    pool.add(promise)
    promise.finally(() => pool.delete(promise))

    if (pool.size >= concurrency) {
      await Promise.race(pool)
    }
  }

  await Promise.all(pool)
}

module.exports = { runConcurrently }
