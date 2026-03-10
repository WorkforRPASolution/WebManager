/**
 * Config Backup Service
 *
 * Handles backup/restore of config files on remote FTP servers.
 * Backup files are stored in: {parentDir}/backup/{configFileName}/{timestamp}.{ext}
 */

const path = require('path')
const { Readable } = require('stream')
const { createBufferCollector } = require('../../shared/utils/streamCollector')
const { isFtpNotFoundError } = require('../../shared/utils/ftpErrors')

const DEFAULT_MAX_BACKUPS = 5

// ============================================
// Pure helper functions
// ============================================

/**
 * Get the backup directory path for a config file.
 * e.g. /app/conf/ARSAgent/application.json → /app/conf/ARSAgent/backup/application.json
 */
function getBackupDir(configPath) {
  const dir = path.posix.dirname(configPath)
  const basename = path.posix.basename(configPath)
  return path.posix.join(dir, 'backup', basename)
}

/**
 * Get the full backup file path for a given timestamp.
 * e.g. (/app/conf/ARSAgent/application.json, '20260223_153042')
 *   → /app/conf/ARSAgent/backup/application.json/20260223_153042.json
 */
function getBackupFilePath(configPath, timestamp) {
  const backupDir = getBackupDir(configPath)
  const ext = path.posix.extname(configPath)
  return path.posix.join(backupDir, timestamp + ext)
}

/**
 * Parse a timestamp from a backup filename.
 * @returns {{ raw: string, date: Date } | null}
 */
function parseTimestampFromFilename(filename) {
  if (!filename) return null
  const match = filename.match(/^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/)
  if (!match) return null
  const [, year, month, day, hour, min, sec] = match
  return {
    raw: `${year}${month}${day}_${hour}${min}${sec}`,
    date: new Date(+year, +month - 1, +day, +hour, +min, +sec)
  }
}

/**
 * Generate a timestamp string from a Date.
 * @param {Date} [date] - Defaults to now
 * @returns {string} YYYYMMDD_HHmmss
 */
function generateTimestamp(date) {
  const d = date || new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
}

/**
 * Select backup files to prune (delete) to stay within maxBackups.
 * We keep maxBackups-1 existing files (to make room for the new backup).
 * @param {string[]} files - Existing backup filenames
 * @param {number} maxBackups - Maximum backups to keep (including the new one)
 * @returns {string[]} Filenames to delete (oldest first)
 */
function selectFilesToPrune(files, maxBackups) {
  if (files.length === 0) return []
  const sorted = [...files].sort()
  const keepCount = maxBackups - 1
  if (sorted.length <= keepCount) return []
  return sorted.slice(0, sorted.length - keepCount)
}

// ============================================
// FTP backup operations
// ============================================

/**
 * Backup a config file before overwriting.
 * Reads the current content, saves to backup dir, prunes old backups.
 * @param {import('basic-ftp').Client} ftpClient - Connected FTP client
 * @param {string} configPath - Remote config file path
 * @param {number} [maxBackups=5] - Max backups to keep
 * @returns {Promise<{backed: boolean, backupPath: string|null}>}
 */
async function backupConfigFile(ftpClient, configPath, maxBackups = DEFAULT_MAX_BACKUPS) {
  // Read current content
  let currentContent
  try {
    const collector = createBufferCollector()
    await ftpClient.downloadTo(collector.writable, configPath)
    currentContent = collector.toString()
  } catch (err) {
    // File doesn't exist yet — nothing to backup
    if (isFtpNotFoundError(err)) {
      return { backed: false, backupPath: null }
    }
    throw err
  }

  // Generate backup path
  const timestamp = generateTimestamp()
  const backupPath = getBackupFilePath(configPath, timestamp)
  const backupDir = getBackupDir(configPath)

  // Ensure backup directory exists and write backup
  await ftpClient.ensureDir(backupDir)
  await ftpClient.cd('/')
  const readable = Readable.from(Buffer.from(currentContent, 'utf-8'))
  await ftpClient.uploadFrom(readable, backupPath)

  // Prune old backups
  try {
    const listing = await ftpClient.list(backupDir)
    const backupFiles = listing
      .filter(entry => entry.type === 1)
      .map(entry => entry.name)
      .filter(name => parseTimestampFromFilename(name) !== null)

    const toDelete = selectFilesToPrune(backupFiles, maxBackups)
    for (const file of toDelete) {
      await ftpClient.remove(path.posix.join(backupDir, file))
    }
  } catch {
    // Prune failure is non-critical
  }

  return { backed: true, backupPath }
}

/**
 * List backups for a config file (newest first).
 * @param {import('basic-ftp').Client} ftpClient - Connected FTP client
 * @param {string} configPath - Remote config file path
 * @returns {Promise<Array<{name: string, timestamp: string, date: Date, size: number}>>}
 */
async function listBackups(ftpClient, configPath) {
  const backupDir = getBackupDir(configPath)

  let listing
  try {
    listing = await ftpClient.list(backupDir)
  } catch (err) {
    if (isFtpNotFoundError(err)) {
      return []
    }
    throw err
  }

  return listing
    .filter(entry => entry.type === 1)
    .map(entry => {
      const parsed = parseTimestampFromFilename(entry.name)
      if (!parsed) return null
      return {
        name: entry.name,
        timestamp: parsed.raw,
        date: parsed.date,
        size: entry.size
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.date - a.date) // newest first
}

/**
 * Read a backup file's content.
 * @param {import('basic-ftp').Client} ftpClient - Connected FTP client
 * @param {string} configPath - Original config file path
 * @param {string} backupName - Backup filename (e.g. '20260223_153042.json')
 * @returns {Promise<string>}
 */
async function readBackup(ftpClient, configPath, backupName) {
  const backupDir = getBackupDir(configPath)
  const backupPath = path.posix.join(backupDir, backupName)
  const collector = createBufferCollector()
  await ftpClient.downloadTo(collector.writable, backupPath)
  return collector.toString()
}

/**
 * Backup existing file then write new content. Used by deploy operations.
 * @param {import('basic-ftp').Client} ftpClient - Connected FTP client
 * @param {string} remotePath - Remote file path
 * @param {string} content - New content to write
 * @param {number} [maxBackups=5]
 */
async function writeConfigWithBackup(ftpClient, remotePath, content, maxBackups = DEFAULT_MAX_BACKUPS) {
  await backupConfigFile(ftpClient, remotePath, maxBackups)

  // Write new content
  const dir = path.posix.dirname(remotePath)
  if (dir && dir !== '/' && dir !== '.') {
    await ftpClient.ensureDir(dir)
    await ftpClient.cd('/')
  }
  const readable = Readable.from(Buffer.from(content, 'utf-8'))
  await ftpClient.uploadFrom(readable, remotePath)
}

module.exports = {
  // Pure helpers
  getBackupDir,
  getBackupFilePath,
  parseTimestampFromFilename,
  generateTimestamp,
  selectFilesToPrune,
  // FTP operations
  backupConfigFile,
  listBackups,
  readBackup,
  writeConfigWithBackup
}
