/**
 * Update Source Factory
 */

const LocalSource = require('./localSource')
const FtpSource = require('./ftpSource')
const MinioSource = require('./minioSource')

function createUpdateSource(sourceConfig) {
  if (!sourceConfig || !sourceConfig.type) {
    throw new Error('Source type is required')
  }

  switch (sourceConfig.type) {
    case 'local':
      if (!sourceConfig.localPath) throw new Error('localPath is required for local source')
      return new LocalSource(sourceConfig.localPath)

    case 'ftp':
      if (!sourceConfig.ftpHost) throw new Error('ftpHost is required for FTP source')
      return new FtpSource(sourceConfig)

    case 'minio':
      if (!sourceConfig.minioBucket) throw new Error('minioBucket is required for MinIO source')
      return new MinioSource(sourceConfig)

    default:
      throw new Error(`Unsupported source type: ${sourceConfig.type}`)
  }
}

module.exports = { createUpdateSource }
