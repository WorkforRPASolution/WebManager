const iconv = require('iconv-lite')
const { createLogger } = require('../logger')
const log = createLogger('rpc')

const NATIVE_ENCODINGS = new Set(['utf-8', 'utf8', 'ascii', 'latin1', 'binary', 'hex', 'base64'])
const FALLBACK_ENCODINGS = ['euc-kr', 'cp949']

// 폴백 임계치: UTF-8 decode 결과에 replacement char가 이 비율 이상이면 EUC-KR 폴백 시도
// 1개라도 깨지면 폴백하는 기존 방식은 false-positive (정상 UTF-8 파일에 우연히 1바이트 깨진 경우 전체가 EUC-KR로 오해석) 위험
const FALLBACK_THRESHOLD = 0.01 // 1%

/**
 * Decode a buffer using the specified encoding, with EUC-KR/CP949 fallback
 * for UTF-8 decoding that produces replacement characters above threshold.
 *
 * IMPORTANT: This function expects a COMPLETE buffer, not streaming chunks.
 * Calling per-chunk in a streaming context can mis-classify multi-byte
 * boundaries as encoding errors and incorrectly trigger fallback.
 */
function decodeBuffer(buffer, encoding = 'utf-8') {
  const enc = encoding.toLowerCase().trim()
  if (NATIVE_ENCODINGS.has(enc)) {
    const result = buffer.toString(enc === 'utf-8' ? 'utf-8' : enc)
    if ((enc === 'utf-8' || enc === 'utf8') && shouldFallback(result)) {
      return tryFallbackEncodings(buffer, result)
    }
    return result
  }
  if (!iconv.encodingExists(enc)) {
    log.warn(`Unknown encoding "${enc}", falling back to utf-8`)
    const result = buffer.toString('utf-8')
    if (shouldFallback(result)) {
      return tryFallbackEncodings(buffer, result)
    }
    return result
  }
  return iconv.decode(buffer, enc)
}

/**
 * 폴백 여부 결정: replacement char (\uFFFD) 비율이 임계치 이상이면 true
 */
function shouldFallback(decoded) {
  if (!decoded.includes('\uFFFD')) return false
  if (decoded.length === 0) return false
  let count = 0
  for (let i = 0; i < decoded.length; i++) {
    if (decoded.charCodeAt(i) === 0xFFFD) count++
  }
  return (count / decoded.length) >= FALLBACK_THRESHOLD
}

function tryFallbackEncodings(buffer, originalDecoded) {
  for (const fallback of FALLBACK_ENCODINGS) {
    const decoded = iconv.decode(buffer, fallback)
    if (!decoded.includes('\uFFFD')) {
      log.info(`UTF-8 decoding had replacement chars (>${FALLBACK_THRESHOLD * 100}%), auto-detected as ${fallback}`)
      return decoded
    }
  }
  // 모든 폴백 실패 — 원본 UTF-8 결과 유지 (replacement chars 표시)
  return originalDecoded
}

module.exports = { decodeBuffer }
