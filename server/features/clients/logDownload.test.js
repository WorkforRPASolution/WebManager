import { describe, it, expect } from 'vitest'
import { getDownloadMeta } from './logDownload'

describe('getDownloadMeta', () => {
  it('단일 파일 — 원본 파일명, octet-stream', () => {
    const meta = getDownloadMeta(['/logs/TestLog_20260223.log'])
    expect(meta.fileName).toBe('TestLog_20260223.log')
    expect(meta.contentType).toBe('application/octet-stream')
  })

  it('경로에서 파일명만 추출', () => {
    const meta = getDownloadMeta(['/deep/nested/path/file.log'])
    expect(meta.fileName).toBe('file.log')
  })

  it('빈 배열 — 에러', () => {
    expect(() => getDownloadMeta([])).toThrow()
  })
})
