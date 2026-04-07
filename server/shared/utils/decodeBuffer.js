const iconv = require('iconv-lite')
const { TextDecoder } = require('util')
const { createLogger } = require('../logger')
const log = createLogger('rpc')

const NATIVE_ENCODINGS = new Set(['utf-8', 'utf8', 'ascii', 'latin1', 'binary', 'hex', 'base64'])
const FALLBACK_ENCODINGS = ['euc-kr', 'cp949']

// Strict UTF-8 validator (fatal mode: invalid byte sequence → throw)
const strictUtf8Decoder = new TextDecoder('utf-8', { fatal: true })

/**
 * Strict UTF-8 byte sequence validation.
 * Returns true only if the buffer is byte-for-byte valid UTF-8 (no invalid sequences).
 * This is the gold standard — much stronger than checking for \uFFFD in
 * a lossy decode result, because some invalid bytes can still produce
 * "looks-like-text" output when mis-interpreted as another encoding.
 */
function isValidUtf8(buffer) {
  try {
    strictUtf8Decoder.decode(buffer)
    return true
  } catch {
    return false
  }
}

/**
 * Decode a buffer using the specified encoding, with EUC-KR/CP949 fallback.
 *
 * Strategy (false-positive 0%):
 * 1. **Valid UTF-8 fast path**: if the buffer is byte-strict valid UTF-8,
 *    use UTF-8 unconditionally. This is critical because UTF-8 multi-byte
 *    sequences can occasionally look like valid EUC-KR sequences, so a naive
 *    fallback would corrupt valid UTF-8 Korean files. Strict validation
 *    closes this hole completely.
 * 2. **Invalid byte sequence**: try the specified encoding; if it produces
 *    \uFFFD, try fallback encodings and accept the one with strictly fewer
 *    replacement chars.
 *
 * IMPORTANT: This function expects a COMPLETE buffer, not streaming chunks.
 * Calling per-chunk in a streaming context can mis-classify multi-byte
 * boundaries as encoding errors and incorrectly trigger fallback.
 */
function decodeBuffer(buffer, encoding = 'utf-8') {
  const enc = encoding.toLowerCase().trim()

  // 1. Valid UTF-8 fast path — false-positive 0%
  if (isValidUtf8(buffer)) {
    return buffer.toString('utf-8')
  }

  // 2. Invalid UTF-8 byte sequence: try specified encoding + fallbacks
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
  // Explicit non-native encoding (e.g., euc-kr) — trust user intent
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

module.exports = { decodeBuffer, isValidUtf8 }
