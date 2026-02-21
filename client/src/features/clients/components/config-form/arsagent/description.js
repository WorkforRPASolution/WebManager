import { parseDuration } from '../shared/formatUtils'

const CRONTAB_TYPE_MAP = {
  AR: '시나리오 실행',
  SR: '코드 시나리오',
  EN: '이메일 발송',
  PU: '팝업 실행'
}

export function describeARSAgent(config) {
  if (!config) return '설정 없음'

  const lines = []

  const triggerCount = (config.ErrorTrigger || []).length
  if (triggerCount > 0) {
    lines.push(`활성 트리거: ${triggerCount}개`)
  }

  const sourceCount = (config.AccessLogLists || []).length
  if (sourceCount > 0) {
    lines.push(`활성 로그소스: ${sourceCount}개`)
  }

  const crontabs = config.CronTab || []
  if (crontabs.length > 0) {
    const summary = crontabs.map(c => {
      const typeLabel = CRONTAB_TYPE_MAP[c.type] || c.type || '?'
      return `${c.name}(${typeLabel})`
    }).join(', ')
    lines.push(`CronTab: ${crontabs.length}개 — ${summary}`)
  }

  if (config.VirtualAddressList) {
    lines.push(`접속 IP: ${config.VirtualAddressList}`)
  }

  const intervals = []
  const alive = parseDuration(config.AliveSignalInterval)
  if (alive) intervals.push(`Alive ${alive}`)
  const redis = parseDuration(config.RedisPingInterval)
  if (redis) intervals.push(`Redis ${redis}`)
  const scenario = parseDuration(config.ScenarioCheckInterval)
  if (scenario) intervals.push(`시나리오 ${scenario}`)

  if (intervals.length > 0) {
    lines.push(`주요 주기: ${intervals.join(' | ')}`)
  }

  if (config.UseRouter === true) {
    let routerLine = '라우터: 사용'
    if (config.PrivateIPAddressPattern) {
      routerLine += ` (내부IP: ${config.PrivateIPAddressPattern})`
    }
    lines.push(routerLine)
  }

  if (lines.length === 0) {
    return '기본 설정'
  }

  return lines.join('\n')
}
