/**
 * MinIO/S3 update source
 */
const Minio = require('minio')
const path = require('path')
const BaseSource = require('./baseSource')

class MinioSource extends BaseSource {
  constructor(config) {
    super()
    this.client = new Minio.Client({
      endPoint: config.minioEndpoint,
      port: config.minioPort || 9000,
      useSSL: config.minioUseSSL || false,
      accessKey: config.minioAccessKey,
      secretKey: config.minioSecretKey
    })
    this.bucket = config.minioBucket
    this.basePath = config.minioBasePath || ''
  }

  _fullPrefix(relativePath) {
    // Join basePath + relativePath, ensure no leading slash, ensure trailing slash for dirs
    const parts = [this.basePath, relativePath || ''].filter(Boolean)
    return parts.join('/').replace(/\/+/g, '/').replace(/^\//, '')
  }

  async listFiles(relativePath) {
    const prefix = this._fullPrefix(relativePath)
    // Ensure prefix ends with / for directory listing (unless empty)
    const dirPrefix = prefix && !prefix.endsWith('/') ? prefix + '/' : prefix

    return new Promise((resolve, reject) => {
      const results = []
      const dirs = new Set()
      const stream = this.client.listObjectsV2(this.bucket, dirPrefix, false)
      stream.on('data', obj => {
        if (obj.prefix) {
          // Directory (common prefix)
          const name = obj.prefix.replace(dirPrefix, '').replace(/\/$/, '')
          if (name) dirs.add(name)
        } else if (obj.name) {
          const name = obj.name.replace(dirPrefix, '')
          if (name && !name.includes('/')) {
            results.push({ name, size: obj.size, isDirectory: false })
          }
        }
      })
      stream.on('error', reject)
      stream.on('end', () => {
        // Add directories first, then files
        const dirEntries = [...dirs].map(d => ({ name: d, size: 0, isDirectory: true }))
        resolve([...dirEntries, ...results])
      })
    })
  }

  async getFileStream(relativePath) {
    const objectName = this._fullPrefix(relativePath)
    return this.client.getObject(this.bucket, objectName)
  }

  async listFilesRecursive(dirPath) {
    const prefix = this._fullPrefix(dirPath)
    const dirPrefix = prefix && !prefix.endsWith('/') ? prefix + '/' : prefix

    return new Promise((resolve, reject) => {
      const results = []
      // true = recursive listing
      const stream = this.client.listObjectsV2(this.bucket, dirPrefix, true)
      stream.on('data', obj => {
        if (obj.name && obj.size > 0) {
          const basePrefix = this.basePath ? this.basePath.replace(/\/$/, '') + '/' : ''
          const relativePath = obj.name.replace(basePrefix, '')
          results.push({ relativePath, size: obj.size })
        }
      })
      stream.on('error', reject)
      stream.on('end', () => resolve(results))
    })
  }

  async close() {
    // MinIO client uses HTTP connection pooling, no explicit close needed
  }
}

module.exports = MinioSource
