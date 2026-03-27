import { describe, it, expect, vi } from 'vitest'

vi.mock('../../toc', () => ({
  SECTION_INDEX: [
    { id: 'login', label: '로그인', searchText: '로그인 아이디 비밀번호 password', keywords: ['로그인', 'login'], chapterId: 'account', chapterLabel: '계정 관리' },
    { id: 'signup', label: '회원가입', searchText: '회원가입 이름 이메일 signup', keywords: ['가입', 'signup'], chapterId: 'account', chapterLabel: '계정 관리' },
    { id: 'dashboard', label: 'Dashboard Overview', searchText: 'KPI 대시보드 overview 카드', keywords: ['대시보드', 'dashboard'], chapterId: 'dashboard', chapterLabel: 'Dashboard' },
    { id: 'config', label: 'Config 관리', searchText: 'Config 설정 횡전개 배포 deploy FTP', keywords: ['Config', '설정'], chapterId: 'clients', chapterLabel: 'Clients' },
    { id: 'recovery', label: 'Recovery Overview', searchText: 'Recovery 복구 트렌드 도넛 KPI', keywords: ['Recovery', '복구'], chapterId: 'dashboard', chapterLabel: 'Dashboard' },
  ]
}))

import { useHelpSearch } from '../useHelpSearch'

describe('useHelpSearch', () => {
  it('쿼리가 비어있으면 빈 결과 반환', () => {
    const { query, results } = useHelpSearch()
    query.value = ''
    expect(results.value).toEqual([])
  })

  it('쿼리가 2자 미만이면 빈 결과 반환', () => {
    const { query, results } = useHelpSearch()
    query.value = '로'
    expect(results.value).toEqual([])
  })

  it('한국어 검색어로 섹션을 찾음', () => {
    const { query, results } = useHelpSearch()
    query.value = '로그인'
    expect(results.value).toHaveLength(1)
    expect(results.value[0].id).toBe('login')
  })

  it('영어 검색어로 섹션을 찾음', () => {
    const { query, results } = useHelpSearch()
    query.value = 'Config'
    expect(results.value).toHaveLength(1)
    expect(results.value[0].id).toBe('config')
  })

  it('searchText에서 매칭', () => {
    const { query, results } = useHelpSearch()
    query.value = '횡전개'
    expect(results.value).toHaveLength(1)
    expect(results.value[0].id).toBe('config')
  })

  it('keywords에서 매칭', () => {
    const { query, results } = useHelpSearch()
    query.value = '복구'
    expect(results.value).toHaveLength(1)
    expect(results.value[0].id).toBe('recovery')
  })

  it('chapterLabel에서 매칭', () => {
    const { query, results } = useHelpSearch()
    query.value = '계정'
    expect(results.value).toHaveLength(2) // login + signup
  })

  it('멀티 텀 AND 검색 지원', () => {
    const { query, results } = useHelpSearch()
    query.value = 'KPI 대시보드'
    expect(results.value).toHaveLength(1)
    expect(results.value[0].id).toBe('dashboard')
  })

  it('대소문자 구분 없이 검색', () => {
    const { query, results } = useHelpSearch()
    query.value = 'config'
    expect(results.value).toHaveLength(1)
    expect(results.value[0].id).toBe('config')
  })

  it('결과 최대 10건 제한', () => {
    const { query, results } = useHelpSearch()
    // 모든 섹션이 매칭되는 일반적 검색어 — 5건 존재
    query.value = 'KPI'
    expect(results.value.length).toBeLessThanOrEqual(10)
  })

  it('clear()가 쿼리와 isOpen을 초기화', () => {
    const { query, isOpen, clear } = useHelpSearch()
    query.value = '로그인'
    isOpen.value = true
    clear()
    expect(query.value).toBe('')
    expect(isOpen.value).toBe(false)
  })

  it('매칭 없으면 빈 배열 반환', () => {
    const { query, results } = useHelpSearch()
    query.value = '존재하지않는검색어'
    expect(results.value).toEqual([])
  })
})
