/**
 * Verification Code Service — Redis 기반 인증 코드 생성/검증
 *
 * Redis keys:
 *   wm:vcode:<mail>            (TTL 300초) — 인증 코드
 *   wm:vcode:cooldown:<mail>   (TTL 60초)  — 재발송 쿨다운
 *   wm:vcode:attempts:<mail>   (TTL 300초) — 실패 시도 횟수
 */

const crypto = require('crypto')
const { getRedisClient, isRedisAvailable } = require('../db/redisConnection')

// --- DI for testing ---
let _getRedisClient = getRedisClient
let _isRedisAvailable = isRedisAvailable

function _setDeps(deps) {
  if (deps.getRedisClient) _getRedisClient = deps.getRedisClient
  if (deps.isRedisAvailable) _isRedisAvailable = deps.isRedisAvailable
}

// --- Key builders ---
const KEY_CODE = (mail) => `wm:vcode:${mail}`
const KEY_COOLDOWN = (mail) => `wm:vcode:cooldown:${mail}`
const KEY_ATTEMPTS = (mail) => `wm:vcode:attempts:${mail}`

const CODE_TTL = 300      // 5분
const COOLDOWN_TTL = 60   // 1분
const MAX_ATTEMPTS = 5

// --- Public interface ---

function generateCode() {
  return crypto.randomInt(0, 1000000).toString().padStart(6, '0')
}

async function storeCode(mail) {
  if (!mail) {
    return { error: '이메일 주소가 필요합니다.' }
  }

  if (!_isRedisAvailable()) {
    return { error: 'Redis not available' }
  }

  const redis = _getRedisClient()

  try {
    // 쿨다운 체크
    const cooldownExists = await redis.exists(KEY_COOLDOWN(mail))
    if (cooldownExists) {
      return { error: '인증 코드 재발송 대기 중입니다. 잠시 후 다시 시도해주세요.' }
    }

    const code = generateCode()

    // 인증 코드 저장 (TTL 300초)
    await redis.set(KEY_CODE(mail), code, 'EX', CODE_TTL)
    // 쿨다운 키 설정 (TTL 60초)
    await redis.set(KEY_COOLDOWN(mail), '1', 'EX', COOLDOWN_TTL)

    return { code }
  } catch (err) {
    return { error: err.message }
  }
}

async function verifyCode(mail, code) {
  if (!mail || !code) {
    return { success: false, error: '이메일과 인증 코드가 필요합니다.' }
  }

  if (!_isRedisAvailable()) {
    return { success: false, error: 'Redis not available' }
  }

  const redis = _getRedisClient()

  try {
    const storedCode = await redis.get(KEY_CODE(mail))

    // 만료 또는 미존재
    if (storedCode === null) {
      return { success: false, error: '인증 코드가 만료되었거나 존재하지 않습니다.' }
    }

    // 코드 일치
    if (storedCode === code) {
      await redis.del(KEY_CODE(mail), KEY_COOLDOWN(mail), KEY_ATTEMPTS(mail))
      return { success: true }
    }

    // 코드 불일치 → attempts 증가
    const attempts = await redis.incr(KEY_ATTEMPTS(mail))
    await redis.expire(KEY_ATTEMPTS(mail), CODE_TTL)

    // 시도 횟수 초과
    if (attempts > MAX_ATTEMPTS) {
      await redis.del(KEY_CODE(mail), KEY_ATTEMPTS(mail))
      return { success: false, error: '인증 시도 횟수를 초과했습니다. 새 인증 코드를 요청해주세요.' }
    }

    return { success: false, error: '인증 코드가 일치하지 않습니다.' }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

/**
 * 인증 코드 확인 (소모하지 않음 — 코드 유효성만 체크)
 */
async function checkCode(mail, code) {
  if (!mail || !code) {
    return { success: false, error: '이메일과 인증 코드가 필요합니다.' }
  }

  if (!_isRedisAvailable()) {
    return { success: false, error: 'Redis not available' }
  }

  const redis = _getRedisClient()

  try {
    const storedCode = await redis.get(KEY_CODE(mail))

    if (storedCode === null) {
      return { success: false, error: '인증 코드가 만료되었거나 존재하지 않습니다.' }
    }

    if (storedCode === code) {
      return { success: true }
    }

    // 불일치 → attempts 증가 (브루트포스 방지)
    const attempts = await redis.incr(KEY_ATTEMPTS(mail))
    await redis.expire(KEY_ATTEMPTS(mail), CODE_TTL)

    if (attempts > MAX_ATTEMPTS) {
      await redis.del(KEY_CODE(mail), KEY_ATTEMPTS(mail))
      return { success: false, error: '인증 시도 횟수를 초과했습니다. 새 인증 코드를 요청해주세요.' }
    }

    return { success: false, error: '인증 코드가 일치하지 않습니다.' }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

module.exports = { generateCode, storeCode, verifyCode, checkCode, _setDeps }
