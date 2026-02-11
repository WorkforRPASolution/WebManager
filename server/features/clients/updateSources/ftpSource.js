/**
 * External FTP update source
 */

const ftp = require('basic-ftp')
const path = require('path')
const { PassThrough } = require('stream')
const BaseSource = require('./baseSource')

class FtpSource extends BaseSource {
  constructor(config) {
    super()
    this.host = config.ftpHost
    this.port = config.ftpPort || 21
    this.user = config.ftpUser
    this.pass = config.ftpPass
    this.basePath = config.ftpBasePath || '/'
    this.client = null
  }

  async _ensureConnected() {
    if (!this.client) {
      this.client = new ftp.Client(30000)
      await this.client.access({
        host: this.host,
        port: this.port,
        user: this.user,
        password: this.pass,
        secure: false
      })
    }
    return this.client
  }

  async listFiles(relativePath) {
    const client = await this._ensureConnected()
    const fullPath = path.posix.join(this.basePath, relativePath || '')
    const listing = await client.list(fullPath)
    return listing.map(entry => ({
      name: entry.name,
      size: entry.size,
      isDirectory: entry.type === 2
    }))
  }

  async getFileStream(relativePath) {
    const fullPath = path.posix.join(this.basePath, relativePath)
    const passthrough = new PassThrough()
    // Create a dedicated FTP connection for this download
    // The shared client (this.client) is reserved for list operations
    const dlClient = new ftp.Client(30000)
    await dlClient.access({
      host: this.host,
      port: this.port,
      user: this.user,
      password: this.pass,
      secure: false
    })
    dlClient.downloadTo(passthrough, fullPath)
      .then(() => dlClient.close())
      .catch(err => {
        passthrough.destroy(err)
        dlClient.close()
      })
    return passthrough
  }

  async listFilesRecursive(dirPath) {
    const client = await this._ensureConnected()
    const fullPath = path.posix.join(this.basePath, dirPath || '')
    const results = []
    await this._walkFtp(client, fullPath, dirPath || '', results)
    return results
  }

  async _walkFtp(client, absPath, relBase, results) {
    const listing = await client.list(absPath)
    for (const entry of listing) {
      const absChild = path.posix.join(absPath, entry.name)
      const relChild = relBase ? path.posix.join(relBase, entry.name) : entry.name
      if (entry.type === 2) {
        await this._walkFtp(client, absChild, relChild, results)
      } else if (entry.type === 1) {
        results.push({ relativePath: relChild, size: entry.size })
      }
    }
  }

  async close() {
    if (this.client) {
      this.client.close()
      this.client = null
    }
  }
}

module.exports = FtpSource
