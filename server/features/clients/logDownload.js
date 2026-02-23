const path = require('path')

function getDownloadMeta(filePaths) {
  if (!filePaths || filePaths.length === 0) throw new Error('filePaths required')
  return {
    fileName: path.basename(filePaths[0]),
    contentType: 'application/octet-stream'
  }
}

module.exports = { getDownloadMeta }
