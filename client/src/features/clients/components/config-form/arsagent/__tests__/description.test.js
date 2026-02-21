import { describe, it, expect } from 'vitest'
import { describeARSAgent } from '../description'

describe('describeARSAgent', () => {
  const FULL_CONFIG = {
    ErrorTrigger: [{ alid: 'TRIGGER_A' }, { alid: 'TRIGGER_B' }],
    AccessLogLists: ['__source1__', '__source2__', '__source3__'],
    CronTab: [
      { name: 'CronTab_Test', type: 'AR' },
      { name: 'Email_Job', type: 'EN' }
    ],
    VirtualAddressList: '10.20.30.40',
    AliveSignalInterval: '5 minutes',
    RedisPingInterval: '5 minutes',
    ScenarioCheckInterval: '1 seconds',
    UseRouter: false,
    PrivateIPAddressPattern: ''
  }

  it('full config → multi-line description', () => {
    const desc = describeARSAgent(FULL_CONFIG)
    expect(desc).toContain('활성 트리거: 2개')
    expect(desc).toContain('활성 로그소스: 3개')
    expect(desc).toContain('CronTab: 2개')
    expect(desc).toContain('접속 IP: 10.20.30.40')
  })

  it('trigger count display', () => {
    const desc = describeARSAgent({ ErrorTrigger: [{ alid: 'A' }] })
    expect(desc).toContain('활성 트리거: 1개')
  })

  it('source count display', () => {
    const desc = describeARSAgent({ AccessLogLists: ['a', 'b'] })
    expect(desc).toContain('활성 로그소스: 2개')
  })

  it('CronTab count + names + Korean types', () => {
    const desc = describeARSAgent({
      CronTab: [
        { name: 'Job1', type: 'AR' },
        { name: 'Job2', type: 'EN' }
      ]
    })
    expect(desc).toContain('CronTab: 2개')
    expect(desc).toContain('Job1(시나리오 실행)')
    expect(desc).toContain('Job2(이메일 발송)')
  })

  it('VirtualAddressList display', () => {
    const desc = describeARSAgent({ VirtualAddressList: '192.168.1.1' })
    expect(desc).toContain('접속 IP: 192.168.1.1')
  })

  it('key intervals in Korean', () => {
    const desc = describeARSAgent({
      AliveSignalInterval: '5 minutes',
      RedisPingInterval: '3 minutes',
      ScenarioCheckInterval: '1 seconds'
    })
    expect(desc).toContain('주요 주기:')
    expect(desc).toContain('Alive 5분')
    expect(desc).toContain('Redis 3분')
    expect(desc).toContain('시나리오 1초')
  })

  it('UseRouter=true → router info shown', () => {
    const desc = describeARSAgent({
      UseRouter: true,
      PrivateIPAddressPattern: '192\\.168\\.0\\.[0-9]+'
    })
    expect(desc).toContain('라우터: 사용')
    expect(desc).toContain('192\\.168\\.0\\.[0-9]+')
  })

  it('UseRouter=false → no router line', () => {
    const desc = describeARSAgent({ UseRouter: false })
    expect(desc).not.toContain('라우터')
  })

  it('empty/null config → 기본 설정', () => {
    expect(describeARSAgent({})).toBe('기본 설정')
    expect(describeARSAgent(null)).toBe('설정 없음')
  })

  it('no CronTab → no CronTab line', () => {
    const desc = describeARSAgent({ VirtualAddressList: '1.2.3.4' })
    expect(desc).not.toContain('CronTab')
  })

  it('multiple CronTab entries comma-separated', () => {
    const desc = describeARSAgent({
      CronTab: [
        { name: 'A', type: 'AR' },
        { name: 'B', type: 'SR' },
        { name: 'C', type: 'PU' }
      ]
    })
    expect(desc).toContain('3개')
    expect(desc).toContain('A(시나리오 실행), B(코드 시나리오), C(팝업 실행)')
  })

  it('UseRouter=true without PrivateIPAddressPattern', () => {
    const desc = describeARSAgent({ UseRouter: true })
    expect(desc).toContain('라우터: 사용')
    expect(desc).not.toContain('내부IP')
  })
})
