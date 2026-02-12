/**
 * Composite Key utility
 *
 * Shared key construction/parsing for the 'eqpId:filePath' pattern
 * used across Log Viewer composables and components.
 */

/**
 * Create a composite key from eqpId and filePath.
 * @param {string} eqpId
 * @param {string} filePath
 * @returns {string} e.g., 'DIRECT_01:/logs/app.log'
 */
export function makeCompositeKey(eqpId, filePath) {
  return `${eqpId}:${filePath}`
}

/**
 * Parse a composite key back into eqpId and filePath.
 * @param {string} key - Composite key (e.g., 'DIRECT_01:/logs/app.log')
 * @returns {{ eqpId: string, filePath: string }}
 */
export function parseCompositeKey(key) {
  const idx = key.indexOf(':')
  return {
    eqpId: key.substring(0, idx),
    filePath: key.substring(idx + 1)
  }
}
