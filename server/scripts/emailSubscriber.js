/**
 * Redis Email Subscriber — UI 테스트용
 *
 * Usage: node server/scripts/emailSubscriber.js
 * Subscribes to all SendEmailTo-* channels and logs received emails.
 */

const Redis = require('ioredis')

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379/0'

const sub = new Redis(REDIS_URL)

sub.on('connect', () => {
  console.log(`\n===================================`)
  console.log(`  Redis Email Subscriber`)
  console.log(`  ${REDIS_URL}`)
  console.log(`===================================`)
  console.log(`\nSendEmailTo-* 채널 구독 중...`)
  console.log(`가입 완료 시 이곳에 알림 메일이 표시됩니다.`)
  console.log(`Ctrl+C로 종료\n`)
})

sub.on('error', (err) => {
  console.error(`Redis 연결 실패: ${err.message}`)
  console.error(`Redis가 실행 중인지 확인하세요.`)
  process.exit(1)
})

// Subscribe to pattern
sub.psubscribe('SendEmailTo-*', (err, count) => {
  if (err) {
    console.error('구독 실패:', err.message)
    process.exit(1)
  }
})

sub.on('pmessage', (pattern, channel, message) => {
  const to = channel.replace('SendEmailTo-', '')
  const [title, ...contentParts] = message.split(':')
  const content = contentParts.join(':')

  console.log(`\n${'='.repeat(60)}`)
  console.log(`[${new Date().toLocaleTimeString()}] 이메일 수신!`)
  console.log(`${'='.repeat(60)}`)
  console.log(`  수신자: ${to}`)
  console.log(`  제목:   ${title}`)
  console.log(`  본문 길이: ${content.length} chars`)
  // Extract text content from HTML for readability
  const textContent = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  console.log(`  본문 (텍스트): ${textContent.substring(0, 200)}...`)
  console.log(`${'='.repeat(60)}\n`)
})
