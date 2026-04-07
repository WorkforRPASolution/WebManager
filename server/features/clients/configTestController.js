/**
 * Config Test Controller - handles test-accesslog API
 * Uses RPC (via controlService.listRemoteFiles) instead of FTP for directory listing.
 *
 * Returns step-by-step results matching client-side testEngine.testAccessLogPath
 * so the UI can render identical detail for both local and remote tests.
 */
const controlService = require('./controlService')
const Client = require('./model')
const { ApiError } = require('../../shared/middleware/errorHandler')
const { formatJoda, resolveJodaTokens } = require('../../shared/utils/jodaFormat')

/**
 * POST /api/clients/:id/test-accesslog
 * Test if files matching an AccessLog source pattern exist on a client.
 *
 * Body: { directory, prefix, wildcard, suffix, exclude_suffix, date_subdir_format, agentGroup }
 * Response: {
 *   files: [{ name, size, modifiedAt, subdir? }],
 *   total, matched,
 *   steps: [{ label, passed, detail }]
 * }
 */
async function testAccessLog(req, res) {
  const { id: eqpId } = req.params
  const body = req.body || {}
  // Trim string inputs to defend against accidental trailing whitespace
  const trimStr = (v) => (typeof v === 'string' ? v.trim() : v)
  const directory = trimStr(body.directory)
  const prefix = trimStr(body.prefix)
  const wildcard = trimStr(body.wildcard)
  const suffix = trimStr(body.suffix)
  const date_subdir_format = trimStr(body.date_subdir_format)
  const agentGroup = trimStr(body.agentGroup)
  const exclude_suffix = Array.isArray(body.exclude_suffix)
    ? body.exclude_suffix.map(s => trimStr(s)).filter(Boolean)
    : []

  if (!directory) {
    return res.status(400).json({ error: '디렉토리 경로는 필수입니다' })
  }
  if (!agentGroup) {
    return res.status(400).json({ error: 'agentGroup은 필수입니다' })
  }

  const steps = []

  try {
    // 1. Resolve directory: absolute → as-is, relative → prepend basePath
    // Normalize input separator to '/' (strategy will convert per OS)
    const normInputDir = directory.replace(/[\\/]+/g, '/')
    let resolvedDir = normInputDir
    if (!isAbsolutePath(directory)) {
      const client = await Client.findOne({ eqpId }).select('basePath').lean()
      const basePath = (client?.basePath || process.env.LOG_REMOTE_BASE_PATH || '').replace(/[\\/]+/g, '/')
      if (basePath) {
        resolvedDir = basePath.replace(/\/+$/, '') + '/' + normInputDir.replace(/^\/+/, '')
      }
    }
    // Strip trailing slash for clean concat
    resolvedDir = resolvedDir.replace(/\/+$/, '')

    steps.push({
      label: '디렉토리',
      passed: true,
      detail: `"${resolvedDir}" 사용`
    })

    // 2. If date_subdir_format is set, resolve to current-date subdir and append
    let listDir = resolvedDir
    let dateSubdir = null
    if (date_subdir_format) {
      try {
        dateSubdir = formatJoda(date_subdir_format, new Date())
          .replace(/[\\/]+/g, '/') // normalize subdir separator too
          .replace(/^\/+|\/+$/g, '') // strip leading/trailing slashes
        if (dateSubdir) {
          listDir = `${resolvedDir}/${dateSubdir}`
          steps.push({
            label: '날짜 서브디렉토리',
            passed: true,
            detail: `"${dateSubdir}" 변환 (원본: "${date_subdir_format}")`
          })
        } else {
          steps.push({
            label: '날짜 서브디렉토리',
            passed: false,
            detail: `포맷 변환 결과가 비어 있음 (원본: "${date_subdir_format}")`
          })
        }
      } catch (err) {
        steps.push({
          label: '날짜 서브디렉토리',
          passed: false,
          detail: `포맷 변환 실패: ${err.message}`
        })
        return res.json({ files: [], total: 0, matched: 0, steps })
      }
    }

    // 3. List files via RPC
    const rpcResult = await controlService.listRemoteFiles(eqpId, agentGroup, listDir)
    if (rpcResult.error) {
      steps.push({
        label: '디렉토리 listing',
        passed: false,
        detail: `${rpcResult.error} (경로: ${listDir})`
      })
      return res.json({ files: [], total: 0, matched: 0, steps })
    }

    const allFiles = rpcResult.files || []
    const total = allFiles.length

    // 처음 5개 파일명 샘플 (디버깅용 — suffix 패턴이 실제 파일과 매칭되는지 확인)
    const sampleNames = allFiles.slice(0, 5).map(f => f.name).join(', ')
    steps.push({
      label: '디렉토리 listing',
      passed: total > 0,
      detail: total > 0
        ? `총 ${total}개 파일 (경로: ${listDir}) — 샘플: ${sampleNames}${total > 5 ? ' …' : ''}`
        : `파일 없음 (경로: ${listDir}) — 디렉토리 경로 또는 separator를 확인하세요`
    })

    // 4. Validate at least one filename filter
    const hasAnyFilter = !!(prefix || suffix || wildcard)
    if (!hasAnyFilter) {
      steps.push({
        label: '파일명 필터',
        passed: false,
        detail: 'prefix, suffix, wildcard 중 최소 1개 항목을 설정해야 합니다'
      })
      return res.json({ files: [], total, matched: 0, steps })
    }

    // 5. Apply pattern filters one by one with step counts
    let pool = allFiles
    let resolvedPrefix = null
    let resolvedSuffix = null
    let resolvedWildcard = null

    if (prefix) {
      resolvedPrefix = resolveJodaTokens(prefix, new Date())
      const before = pool.length
      pool = pool.filter(f => f.name.startsWith(resolvedPrefix))
      const isResolved = resolvedPrefix !== prefix
      steps.push({
        label: 'Prefix',
        passed: pool.length > 0,
        detail: isResolved
          ? `원본: "${prefix}" → 변환: "${resolvedPrefix}" → ${pool.length}/${before}개 매칭`
          : `"${prefix}" → ${pool.length}/${before}개 매칭`
      })
    }

    if (suffix) {
      resolvedSuffix = resolveJodaTokens(suffix, new Date())
      const before = pool.length
      pool = pool.filter(f => f.name.endsWith(resolvedSuffix))
      const isResolved = resolvedSuffix !== suffix
      steps.push({
        label: 'Suffix',
        passed: pool.length > 0,
        detail: isResolved
          ? `원본: "${suffix}" → 변환: "${resolvedSuffix}" → ${pool.length}/${before}개 매칭`
          : `"${suffix}" → ${pool.length}/${before}개 매칭`
      })
    }

    if (wildcard) {
      resolvedWildcard = resolveJodaTokens(wildcard, new Date())
      const before = pool.length
      pool = pool.filter(f => f.name.includes(resolvedWildcard))
      const isResolved = resolvedWildcard !== wildcard
      steps.push({
        label: 'Wildcard',
        passed: pool.length > 0,
        detail: isResolved
          ? `원본: "${wildcard}" → 변환: "${resolvedWildcard}" → ${pool.length}/${before}개 매칭`
          : `"${wildcard}" → ${pool.length}/${before}개 매칭`
      })
    }

    // 6. Exclude suffix
    const excludeList = Array.isArray(exclude_suffix) ? exclude_suffix : []
    if (excludeList.length > 0) {
      const before = pool.length
      const removed = []
      pool = pool.filter(f => {
        const matched = excludeList.find(es => f.name.endsWith(es))
        if (matched) {
          removed.push({ name: f.name, by: matched })
          return false
        }
        return true
      })
      steps.push({
        label: '제외 대상',
        passed: true,
        detail: removed.length > 0
          ? `${removed.length}개 제외 (${before} → ${pool.length})`
          : `제외된 파일 없음 (${pool.length}개 유지)`
      })
    } else {
      steps.push({
        label: '제외 대상',
        passed: true,
        detail: '제외 목록 없음'
      })
    }

    // 7. Sort by modifiedAt descending and tag with subdir
    const matched = pool
      .map(f => dateSubdir ? { ...f, subdir: dateSubdir } : f)
      .sort((a, b) => {
        if (!a.modifiedAt || !b.modifiedAt) return 0
        return new Date(b.modifiedAt) - new Date(a.modifiedAt)
      })

    res.json({ files: matched, total, matched: matched.length, steps })
  } catch (err) {
    throw ApiError.internal(err.message || '원격 파일 목록 조회 실패')
  }
}

/**
 * Filter files by prefix, suffix, wildcard, and exclude_suffix pattern.
 * Kept for backward compatibility with existing tests.
 */
function filterByPattern(files, config) {
  return files.filter(f => {
    if (config.prefix && !f.name.startsWith(config.prefix)) return false
    if (config.suffix && !f.name.endsWith(config.suffix)) return false
    if (config.wildcard && !f.name.includes(config.wildcard)) return false
    if (config.exclude_suffix && config.exclude_suffix.length > 0) {
      if (config.exclude_suffix.some(es => f.name.endsWith(es))) return false
    }
    return true
  })
}

/**
 * Check if a path is absolute (supports both Windows and Linux paths).
 */
function isAbsolutePath(p) {
  if (!p) return false
  if (p.startsWith('/') || p.startsWith('\\')) return true
  if (/^[A-Za-z]:[\\/]/.test(p)) return true
  return false
}

module.exports = {
  testAccessLog,
  filterByPattern,
  isAbsolutePath,
  resolveJodaTokens
}
