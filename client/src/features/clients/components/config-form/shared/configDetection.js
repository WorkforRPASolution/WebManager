/**
 * shared/configDetection.js
 *
 * Config file type detection utility.
 */

const FILE_TYPE_MAP = {
  'accesslog.json': 'accesslog',
  'trigger.json': 'trigger',
  'arsagent.json': 'arsagent',
}

export function detectConfigFileType(fileName, filePath) {
  if (!fileName && !filePath) return null
  // Check display name first
  if (fileName) {
    const match = FILE_TYPE_MAP[fileName.toLowerCase()]
    if (match) return match
  }
  // Fallback: check basename of path
  if (filePath) {
    const basename = filePath.split('/').pop()?.toLowerCase()
    if (basename) {
      const match = FILE_TYPE_MAP[basename]
      if (match) return match
    }
  }
  return null
}
