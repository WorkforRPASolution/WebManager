const iconv = require('iconv-lite')
const { createLogger } = require('../logger')
const log = createLogger('rpc')

const NATIVE_ENCODINGS = new Set(['utf-8', 'utf8', 'ascii', 'latin1', 'binary', 'hex', 'base64'])
const FALLBACK_ENCODINGS = ['euc-kr', 'cp949']

/**
 * Decode a buffer using the specified encoding, with EUC-KR/CP949 fallback.
 *
 * Strategy:
 * - If UTF-8 produces ANY replacement char (\uFFFD), try fallback encodings.
 * - Accept fallback only if it produces *strictly fewer* \uFFFD than original.
 * - This handles both:
 *   a) EUC-KR file mis-decoded as UTF-8 (many \uFFFD → fallback gives 0 → accept)
 *   b) Mostly-ASCII EUC-KR with a few Korean chars (a few \uFFFD → fallback gives 0 → accept)
 *   c) Valid UTF-8 with one corrupt byte (\uFFFD=1 → fallback typically also has \uFFFD → keep original)
 *
 * IMPORTANT: This function expects a COMPLETE buffer, not streaming chunks.
 * Calling per-chunk in a streaming context can mis-classify multi-byte
 * boundaries as encoding errors and incorrectly trigger fallback.
 */
function decodeBuffer(buffer, encoding = 'utf-8') {
  const enc = encoding.toLowerCase().trim()
  if (NATIVE_ENCODINGS.has(enc)) {
    const result = buffer.toString(enc === 'utf-8' ? 'utf-8' : enc)
    if ((enc === 'utf-8' || enc === 'utf8') && result.includes('\uFFFD')) {
      return tryFallbackEncodings(buffer, result)
    }
    return result
  }
  if (!iconv.encodingExists(enc)) {
    log.warn(`Unknown encoding "${enc}", falling back to utf-8`)
    const result = buffer.toString('utf-8')
    if (result.includes('\uFFFD')) {
      return tryFallbackEncodings(buffer, result)
    }
    return result
  }
  return iconv.decode(buffer, enc)
}

function countReplacementChars(s) {
  let count = 0
  for (let i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) === 0xFFFD) count++
  }
  return count
}

/**
 * 폴백 시도: \uFFFD 개수가 strictly less한 결과를 채택.
 * 모든 폴백이 원본보다 같거나 더 많은 \uFFFD를 가지면 원본 유지.
 */
function tryFallbackEncodings(buffer, originalDecoded) {
  const originalCount = countReplacementChars(originalDecoded)

  for (const fallback of FALLBACK_ENCODINGS) {
    const decoded = iconv.decode(buffer, fallback)
    const count = countReplacementChars(decoded)
    if (count < originalCount) {
      log.info(`Auto-detected encoding: ${fallback} (replacement chars: ${originalCount} → ${count})`)
      return decoded
    }
  }
  // 모든 폴백이 원본보다 나쁘거나 같음 → 원본 유지 (false-positive 방지)
  return originalDecoded
}

module.exports = { decodeBuffer }
