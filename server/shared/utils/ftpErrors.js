/**
 * FTP 550 (파일 없음) 에러인지 판별
 * @param {Error|null} err
 * @returns {boolean}
 */
function isFtpNotFoundError(err) {
  if (!err) return false
  return err.code === 550 || Boolean(err.message && err.message.includes('No such file'))
}

module.exports = { isFtpNotFoundError }
