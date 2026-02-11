/**
 * Base Update Source - Interface definition
 * All update sources must implement these methods
 */

class BaseSource {
  async listFiles(relativePath) {
    throw new Error('Not implemented: listFiles')
  }

  async getFileStream(relativePath) {
    throw new Error('Not implemented: getFileStream')
  }

  async listFilesRecursive(dirPath) {
    throw new Error('Not implemented: listFilesRecursive')
  }

  async close() {
    // Optional cleanup
  }
}

module.exports = BaseSource
