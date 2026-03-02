import { parseGoDuration } from '../shared/formatUtils'

const SENDER_TYPE_MAP = {
  kafka: 'Kafka 직접 전송',
  kafkarest: 'KafkaRest Proxy',
  file: '로컬 파일'
}

/**
 * Generate a human-readable Korean description of ResourceAgent config.
 * Receives the ORIGINAL nested config object (not flattened formData).
 *
 * @param {Object|null} config - Nested ResourceAgent.json config
 * @returns {string} Korean description
 */
export function describeResourceAgent(config) {
  if (!config) return '설정 없음'

  const lines = []

  // 전송 방식
  const senderType = config.SenderType
  if (senderType) {
    const senderLabel = SENDER_TYPE_MAP[senderType] || senderType
    lines.push(`전송 방식: ${senderLabel}`)
  }

  // Kafka broker info (kafka sender only)
  if (senderType === 'kafka' || senderType === 'kafkarest') {
    const kafka = config.Kafka || {}
    const brokers = kafka.Brokers || []
    if (brokers.length > 0) {
      lines.push(`브로커: ${brokers.length}개 (${brokers.join(', ')})`)
    }
  }

  // File path info (file sender only)
  if (senderType === 'file') {
    const file = config.File || {}
    if (file.FilePath) {
      lines.push(`파일: ${file.FilePath}`)
    }
  }

  // TLS / SASL
  if (senderType === 'kafka') {
    const kafka = config.Kafka || {}
    const parts = []
    if (kafka.EnableTLS === true) {
      parts.push('TLS: 사용')
    }
    if (kafka.SASLEnabled === true) {
      parts.push(`SASL: ${kafka.SASLMechanism || '사용'}`)
    }
    if (parts.length > 0) {
      lines.push(parts.join(' | '))
    }
  }

  // Redis
  const redis = config.Redis
  if (redis && (redis.Port || redis.DB !== undefined)) {
    const port = redis.Port || 50001
    const db = redis.DB !== undefined ? redis.DB : 10
    lines.push(`Redis: 포트 ${port}, DB ${db}`)
  }

  // SOCKS Proxy
  const socks = config.SocksProxy
  if (socks && socks.Host) {
    lines.push(`SOCKS: ${socks.Host}:${socks.Port || 0}`)
  }

  if (lines.length === 0) {
    return '기본 설정'
  }

  return lines.join('\n')
}
