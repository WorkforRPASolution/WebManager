import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getBackupDir,
  getBackupFilePath,
  parseTimestampFromFilename,
  generateTimestamp,
  selectFilesToPrune,
  backupConfigFile,
  listBackups,
  readBackup,
  writeConfigWithBackup
} from './configBackupService.js'

describe('getBackupDir', () => {
  it('returns backup dir under parent directory with config filename', () => {
    expect(getBackupDir('/app/conf/ARSAgent/application.json'))
      .toBe('/app/conf/ARSAgent/backup/application.json')
  })

  it('handles nested paths', () => {
    expect(getBackupDir('/opt/ars/config/agent.conf'))
      .toBe('/opt/ars/config/backup/agent.conf')
  })

  it('handles root-level files', () => {
    expect(getBackupDir('/config.json'))
      .toBe('/backup/config.json')
  })
})

describe('getBackupFilePath', () => {
  it('combines backup dir with timestamp and original extension', () => {
    expect(getBackupFilePath('/app/conf/ARSAgent/application.json', '20260223_153042'))
      .toBe('/app/conf/ARSAgent/backup/application.json/20260223_153042.json')
  })

  it('works with different extensions', () => {
    expect(getBackupFilePath('/opt/config/agent.conf', '20260101_120000'))
      .toBe('/opt/config/backup/agent.conf/20260101_120000.conf')
  })

  it('works with files without extension', () => {
    expect(getBackupFilePath('/opt/config/Makefile', '20260101_120000'))
      .toBe('/opt/config/backup/Makefile/20260101_120000')
  })
})

describe('parseTimestampFromFilename', () => {
  it('parses valid timestamp filename with extension', () => {
    const result = parseTimestampFromFilename('20260223_153042.json')
    expect(result).toEqual({
      raw: '20260223_153042',
      date: new Date(2026, 1, 23, 15, 30, 42)
    })
  })

  it('parses filename without extension', () => {
    const result = parseTimestampFromFilename('20260101_120000')
    expect(result).toEqual({
      raw: '20260101_120000',
      date: new Date(2026, 0, 1, 12, 0, 0)
    })
  })

  it('returns null for invalid filename', () => {
    expect(parseTimestampFromFilename('not-a-timestamp.json')).toBeNull()
    expect(parseTimestampFromFilename('readme.txt')).toBeNull()
    expect(parseTimestampFromFilename('')).toBeNull()
  })
})

describe('generateTimestamp', () => {
  it('formats date as YYYYMMDD_HHmmss', () => {
    const date = new Date(2026, 1, 23, 15, 30, 42) // Feb 23, 2026 15:30:42
    expect(generateTimestamp(date)).toBe('20260223_153042')
  })

  it('pads single-digit values', () => {
    const date = new Date(2026, 0, 5, 3, 7, 9) // Jan 5, 2026 03:07:09
    expect(generateTimestamp(date)).toBe('20260105_030709')
  })

  it('uses current time when no date provided', () => {
    const ts = generateTimestamp()
    expect(ts).toMatch(/^\d{8}_\d{6}$/)
  })
})

describe('selectFilesToPrune', () => {
  it('returns empty array when files are within limit', () => {
    const files = ['20260101_120000.json', '20260102_120000.json']
    // maxBackups=5, but we're about to add one more, so keep maxBackups-1=4
    expect(selectFilesToPrune(files, 5)).toEqual([])
  })

  it('returns oldest files when count exceeds maxBackups-1', () => {
    const files = [
      '20260101_120000.json',
      '20260102_120000.json',
      '20260103_120000.json',
      '20260104_120000.json',
      '20260105_120000.json'
    ]
    // maxBackups=5, about to add 1 more → keep 4 → prune 1 oldest
    const result = selectFilesToPrune(files, 5)
    expect(result).toEqual(['20260101_120000.json'])
  })

  it('returns multiple oldest files when way over limit', () => {
    const files = [
      '20260101_120000.json',
      '20260102_120000.json',
      '20260103_120000.json',
      '20260104_120000.json',
      '20260105_120000.json',
      '20260106_120000.json',
      '20260107_120000.json'
    ]
    // maxBackups=5, keep 4 → prune 3
    const result = selectFilesToPrune(files, 5)
    expect(result).toEqual([
      '20260101_120000.json',
      '20260102_120000.json',
      '20260103_120000.json'
    ])
  })

  it('returns empty array for empty file list', () => {
    expect(selectFilesToPrune([], 5)).toEqual([])
  })

  it('handles unsorted input by sorting first', () => {
    const files = [
      '20260105_120000.json',
      '20260101_120000.json',
      '20260103_120000.json',
      '20260102_120000.json',
      '20260104_120000.json'
    ]
    const result = selectFilesToPrune(files, 5)
    expect(result).toEqual(['20260101_120000.json'])
  })
})

// ============================================
// Cycle 2: FTP backup operations (mock FTP)
// ============================================

function createMockFtpClient(files = {}) {
  // files: { '/path/to/file': 'content', ... }
  const store = { ...files }

  return {
    downloadTo: vi.fn(async (writable, remotePath) => {
      if (!(remotePath in store)) {
        const err = new Error(`550 No such file: ${remotePath}`)
        err.code = 550
        throw err
      }
      writable.write(Buffer.from(store[remotePath], 'utf-8'))
      writable.end()
      // Wait for writable to finish
      await new Promise(resolve => writable.on('finish', resolve))
    }),
    uploadFrom: vi.fn(async (readable, remotePath) => {
      const chunks = []
      for await (const chunk of readable) {
        chunks.push(chunk)
      }
      store[remotePath] = Buffer.concat(chunks).toString('utf-8')
    }),
    ensureDir: vi.fn(async () => {}),
    cd: vi.fn(async () => {}),
    list: vi.fn(async (dirPath) => {
      // Return entries whose path starts with dirPath
      const entries = []
      for (const [filePath, content] of Object.entries(store)) {
        const dir = filePath.substring(0, filePath.lastIndexOf('/'))
        if (dir === dirPath) {
          const name = filePath.substring(filePath.lastIndexOf('/') + 1)
          entries.push({ name, type: 1, size: content.length })
        }
      }
      return entries
    }),
    remove: vi.fn(async (remotePath) => {
      delete store[remotePath]
    }),
    _store: store
  }
}

describe('backupConfigFile', () => {
  it('backs up existing file to backup directory', async () => {
    const ftpClient = createMockFtpClient({
      '/app/conf/app.json': '{"old":"config"}'
    })

    const result = await backupConfigFile(ftpClient, '/app/conf/app.json')

    expect(result.backed).toBe(true)
    expect(result.backupPath).toMatch(/\/app\/conf\/backup\/app\.json\/\d{8}_\d{6}\.json/)
    expect(ftpClient.ensureDir).toHaveBeenCalledWith('/app/conf/backup/app.json')
    expect(ftpClient.uploadFrom).toHaveBeenCalled()
  })

  it('skips backup when file does not exist (550)', async () => {
    const ftpClient = createMockFtpClient({})

    const result = await backupConfigFile(ftpClient, '/app/conf/app.json')

    expect(result.backed).toBe(false)
    expect(result.backupPath).toBeNull()
    expect(ftpClient.uploadFrom).not.toHaveBeenCalled()
  })

  it('prunes oldest backups when exceeding maxBackups', async () => {
    const store = {
      '/app/conf/app.json': '{"current":"data"}',
      '/app/conf/backup/app.json/20260101_120000.json': '{"v":"1"}',
      '/app/conf/backup/app.json/20260102_120000.json': '{"v":"2"}',
      '/app/conf/backup/app.json/20260103_120000.json': '{"v":"3"}',
      '/app/conf/backup/app.json/20260104_120000.json': '{"v":"4"}'
    }
    const ftpClient = createMockFtpClient(store)

    // maxBackups=3: keep 2 existing + 1 new = prune 2
    await backupConfigFile(ftpClient, '/app/conf/app.json', 3)

    expect(ftpClient.remove).toHaveBeenCalledWith('/app/conf/backup/app.json/20260101_120000.json')
    expect(ftpClient.remove).toHaveBeenCalledWith('/app/conf/backup/app.json/20260102_120000.json')
  })
})

describe('listBackups', () => {
  it('lists backup files sorted newest first', async () => {
    const ftpClient = createMockFtpClient({
      '/app/conf/backup/app.json/20260101_120000.json': 'v1',
      '/app/conf/backup/app.json/20260103_120000.json': 'v3',
      '/app/conf/backup/app.json/20260102_120000.json': 'v2'
    })

    const result = await listBackups(ftpClient, '/app/conf/app.json')

    expect(result).toHaveLength(3)
    expect(result[0].timestamp).toBe('20260103_120000')
    expect(result[1].timestamp).toBe('20260102_120000')
    expect(result[2].timestamp).toBe('20260101_120000')
    expect(result[0].name).toBe('20260103_120000.json')
    expect(result[0].size).toBe(2)
  })

  it('returns empty array when backup dir does not exist', async () => {
    const ftpClient = createMockFtpClient({})

    const result = await listBackups(ftpClient, '/app/conf/app.json')

    expect(result).toEqual([])
  })
})

describe('readBackup', () => {
  it('reads backup file content', async () => {
    const ftpClient = createMockFtpClient({
      '/app/conf/backup/app.json/20260101_120000.json': '{"restored":"data"}'
    })

    const content = await readBackup(ftpClient, '/app/conf/app.json', '20260101_120000.json')

    expect(content).toBe('{"restored":"data"}')
  })
})

describe('writeConfigWithBackup', () => {
  it('backs up existing file then writes new content', async () => {
    const ftpClient = createMockFtpClient({
      '/app/conf/app.json': '{"old":"config"}'
    })

    await writeConfigWithBackup(ftpClient, '/app/conf/app.json', '{"new":"config"}')

    // New content should be written
    expect(ftpClient._store['/app/conf/app.json']).toBe('{"new":"config"}')
    // A backup should exist
    const backupKeys = Object.keys(ftpClient._store).filter(k => k.includes('/backup/'))
    expect(backupKeys).toHaveLength(1)
    expect(ftpClient._store[backupKeys[0]]).toBe('{"old":"config"}')
  })

  it('writes new content even when no existing file to backup', async () => {
    const ftpClient = createMockFtpClient({})

    await writeConfigWithBackup(ftpClient, '/app/conf/app.json', '{"new":"config"}')

    expect(ftpClient._store['/app/conf/app.json']).toBe('{"new":"config"}')
    const backupKeys = Object.keys(ftpClient._store).filter(k => k.includes('/backup/'))
    expect(backupKeys).toHaveLength(0)
  })
})
