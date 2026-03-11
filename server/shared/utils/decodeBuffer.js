const iconv = require('iconv-lite')

const NATIVE_ENCODINGS = new Set(['utf-8', 'utf8', 'ascii', 'latin1', 'binary', 'hex', 'base64'])

function decodeBuffer(buffer, encoding = 'utf-8') {
  const enc = encoding.toLowerCase().trim()
  if (NATIVE_ENCODINGS.has(enc)) {
    return buffer.toString(enc === 'utf-8' ? 'utf-8' : enc)
  }
  if (!iconv.encodingExists(enc)) {
    console.warn(`Unknown encoding "${enc}", falling back to utf-8`)
    return buffer.toString('utf-8')
  }
  return iconv.decode(buffer, enc)
}

module.exports = { decodeBuffer }
