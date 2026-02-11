/**
 * Local filesystem update source
 */

const fs = require('fs')
const fsPromises = require('fs/promises')
const path = require('path')
const BaseSource = require('./baseSource')

class LocalSource extends BaseSource {
  constructor(basePath) {
    super()
    this.basePath = basePath
  }

  async listFiles(relativePath) {
    const fullPath = path.join(this.basePath, relativePath || '')
    const entries = await fsPromises.readdir(fullPath, { withFileTypes: true })
    return entries.map(entry => ({
      name: entry.name,
      size: 0, // size requires stat call, skip for listing
      isDirectory: entry.isDirectory()
    }))
  }

  async getFileStream(relativePath) {
    const fullPath = path.join(this.basePath, relativePath)
    // Verify file exists
    await fsPromises.access(fullPath, fs.constants.R_OK)
    return fs.createReadStream(fullPath)
  }

  async listFilesRecursive(dirPath) {
    const fullPath = path.join(this.basePath, dirPath || '')
    const results = []
    await this._walk(fullPath, dirPath || '', results)
    return results
  }

  async _walk(absPath, relBase, results) {
    const entries = await fsPromises.readdir(absPath, { withFileTypes: true })
    for (const entry of entries) {
      const absChild = path.join(absPath, entry.name)
      const relChild = path.posix.join(relBase, entry.name)
      if (entry.isDirectory()) {
        await this._walk(absChild, relChild, results)
      } else {
        const stat = await fsPromises.stat(absChild)
        results.push({ relativePath: relChild, size: stat.size })
      }
    }
  }
}

module.exports = LocalSource
