const iconv = require('iconv-lite')
const { createLogger } = require('../logger')
const log = createLogger('rpc')

const NATIVE_ENCODINGS = new Set(['utf-8', 'utf8', 'ascii', 'latin1', 'binary', 'hex', 'base64'])
const FALLBACK_ENCODINGS = ['euc-kr', 'cp949']

function decodeBuffer(buffer, encoding = 'utf-8') {
  const enc = encoding.toLowerCase().trim()
  if (NATIVE_ENCODINGS.has(enc)) {
    const result = buffer.toString(enc === 'utf-8' ? 'utf-8' : enc)
    if ((enc === 'utf-8' || enc === 'utf8') && result.includes('\uFFFD')) {
      return tryFallbackEncodings(buffer)
    }
    return result
  }
  if (!iconv.encodingExists(enc)) {
    log.warn(`Unknown encoding "${enc}", falling back to utf-8`)
    const result = buffer.toString('utf-8')
    if (result.includes('\uFFFD')) {
      return tryFallbackEncodings(buffer)
    }
    return result
  }
  return iconv.decode(buffer, enc)
}

function tryFallbackEncodings(buffer) {
  for (const fallback of FALLBACK_ENCODINGS) {
    const decoded = iconv.decode(buffer, fallback)
    if (!decoded.includes('\uFFFD')) {
      log.info(`UTF-8 decoding had replacement chars, auto-detected as ${fallback}`)
      return decoded
    }
  }
  return buffer.toString('utf-8')
}

module.exports = { decodeBuffer }
