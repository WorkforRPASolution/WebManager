/**
 * Config Test Controller - handles test-accesslog API
 */
const ftpService = require('./ftpService')

/**
 * POST /api/clients/:id/test-accesslog
 * Test if files matching an AccessLog source pattern exist on a client
 * 
 * Body: { directory, prefix, wildcard, suffix, exclude_suffix, date_subdir_format, agentGroup }
 * Response: { files: [{ name, size, modifiedAt }], total, matched }
 */
async function testAccessLog(req, res) {
  const { id: eqpId } = req.params
  const { directory, prefix, wildcard, suffix, exclude_suffix, date_subdir_format, agentGroup } = req.body

  if (!directory) {
    return res.status(400).json({ error: '디렉토리 경로는 필수입니다' })
  }

  const sourceConfig = {
    directory,
    prefix: prefix || '',
    wildcard: wildcard || '',
    suffix: suffix || '',
    exclude_suffix: exclude_suffix || [],
    date_subdir_format: date_subdir_format || ''
  }

  const result = await ftpService.listAccessLogFiles(eqpId, sourceConfig, agentGroup)
  res.json(result)
}

module.exports = {
  testAccessLog
}
