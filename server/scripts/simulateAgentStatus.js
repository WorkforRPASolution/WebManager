/**
 * Agent Running Status 시뮬레이터
 *
 * EQP_INFO에서 설비 목록을 읽어 Redis에 AgentRunning 키를 SET EX로 설정합니다.
 * Agent Monitor 페이지 테스트에 활용할 수 있습니다.
 *
 * Usage:
 *   node scripts/simulateAgentStatus.js                    # 전체 설비 70% running, TTL 120초
 *   node scripts/simulateAgentStatus.js --rate 50          # 50% running
 *   node scripts/simulateAgentStatus.js --ttl 300          # TTL 300초
 *   node scripts/simulateAgentStatus.js --process CVD      # CVD만
 *   node scripts/simulateAgentStatus.js --watch 30         # 30초마다 반복 갱신 (Ctrl+C 종료)
 *   node scripts/simulateAgentStatus.js --clear            # 시뮬레이션 키 전부 제거
 *   node scripts/simulateAgentStatus.js --list             # 현재 키 상태 조회
 */

require('dotenv').config()
const Redis = require('ioredis')
const { connectDB, closeConnections } = require('../shared/db/connection')
const Client = require('../features/clients/model')

// --- Args parsing ---
const args = process.argv.slice(2)
function getArg(name) {
  const idx = args.indexOf(`--${name}`)
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : null
}
const hasFlag = (name) => args.includes(`--${name}`)

const RATE = parseInt(getArg('rate') || '70', 10)
const TTL = parseInt(getArg('ttl') || '120', 10)
const PROCESS_FILTER = getArg('process')
const WATCH_INTERVAL = getArg('watch') ? parseInt(getArg('watch'), 10) : null
const CLEAR_MODE = hasFlag('clear')
const LIST_MODE = hasFlag('list')

// --- Redis connection (standalone, not reusing server singleton) ---
function createRedis() {
  const url = process.env.REDIS_URL
  if (!url) {
    console.error('REDIS_URL 환경변수가 설정되지 않았습니다.')
    process.exit(1)
  }
  const client = new Redis(url, { maxRetriesPerRequest: 3, lazyConnect: true })
  return client
}

function buildKey(process, eqpModel, eqpId) {
  return `AgentRunning:${process}-${eqpModel}-${eqpId}`
}

function buildMetaInfoKey(process, eqpModel) {
  return `AgentMetaInfo:${process}-${eqpModel}`
}

function buildResourceAgentHealthKey(process, eqpModel, eqpId) {
  return `AgentHealth:resource_agent:${process}-${eqpModel}-${eqpId}`
}

function buildResourceAgentMetaInfoKey(process, eqpModel) {
  return `ResourceAgentMetaInfo:${process}-${eqpModel}`
}

const META_RATE = parseInt(getArg('meta-rate') || '60', 10) // not-running 중 MetaInfo 비율 (Stopped vs NeverStarted)

// 버전 시뮬레이션용
const DEFAULT_VERSIONS = ['7.1.0.0', '7.0.0.0', '6.8.5.24', '6.8.4.0', '6.8.3.0']
const SIM_VERSIONS = getArg('versions') ? getArg('versions').split(',') : DEFAULT_VERSIONS

// ResourceAgent 버전
const DEFAULT_RES_VERSIONS = ['2.0.0', '1.5.0', '1.1.0', '1.0.0']
const RES_HEALTH_STATES = ['OK', 'WARN', 'SHUTDOWN']
const RES_HEALTH_WEIGHTS = [70, 20, 10]  // OK 70%, WARN 20%, SHUTDOWN 10%

function randomVersion() {
  return SIM_VERSIONS[Math.floor(Math.random() * SIM_VERSIONS.length)]
}

function randomResVersion() {
  return DEFAULT_RES_VERSIONS[Math.floor(Math.random() * DEFAULT_RES_VERSIONS.length)]
}

function randomHealthState() {
  const r = Math.random() * 100
  let acc = 0
  for (let i = 0; i < RES_HEALTH_STATES.length; i++) {
    acc += RES_HEALTH_WEIGHTS[i]
    if (r < acc) return RES_HEALTH_STATES[i]
  }
  return 'OK'
}

async function main() {
  // 1. Connect
  await connectDB()
  const redis = createRedis()
  await redis.connect()
  console.log('MongoDB + Redis 연결 완료\n')

  // 2. Load clients
  const query = PROCESS_FILTER ? { process: PROCESS_FILTER } : {}
  const clients = await Client.find(query).select('process eqpModel eqpId').lean()

  if (clients.length === 0) {
    console.log('조건에 맞는 설비가 없습니다.')
    await cleanup(redis)
    return
  }

  console.log(`대상 설비: ${clients.length}개${PROCESS_FILTER ? ` (process: ${PROCESS_FILTER})` : ''}\n`)

  // --- LIST mode ---
  if (LIST_MODE) {
    const keys = clients.map(c => buildKey(c.process, c.eqpModel, c.eqpId))
    const values = await redis.mget(keys)

    let running = 0
    for (let i = 0; i < clients.length; i++) {
      const c = clients[i]
      const val = values[i]
      const status = val ? `RUNNING (uptime: ${val}s)` : 'STOPPED'
      if (val) running++
      console.log(`  ${buildKey(c.process, c.eqpModel, c.eqpId)} → ${status}`)
    }
    console.log(`\n합계: ${running}/${clients.length} running (${Math.round(running / clients.length * 100)}%)`)

    await cleanup(redis)
    return
  }

  // --- CLEAR mode ---
  if (CLEAR_MODE) {
    const pipeline = redis.pipeline()
    for (const c of clients) {
      pipeline.del(buildKey(c.process, c.eqpModel, c.eqpId))
      pipeline.del(buildResourceAgentHealthKey(c.process, c.eqpModel, c.eqpId))
    }
    await pipeline.exec()
    console.log(`${clients.length * 2}개 키 삭제 완료 (ARSAgent + ResourceAgent)`)

    await cleanup(redis)
    return
  }

  // --- SIMULATE mode ---
  await simulate(redis, clients)

  if (WATCH_INTERVAL) {
    console.log(`\n[watch] ${WATCH_INTERVAL}초마다 반복 갱신 (Ctrl+C로 종료)\n`)
    const timer = setInterval(() => simulate(redis, clients), WATCH_INTERVAL * 1000)
    process.on('SIGINT', async () => {
      clearInterval(timer)
      console.log('\n[watch] 종료')
      await cleanup(redis)
      process.exit(0)
    })
  } else {
    await cleanup(redis)
  }
}

async function simulate(redis, clients) {
  const shuffled = [...clients].sort(() => Math.random() - 0.5)
  const runningCount = Math.round(clients.length * RATE / 100)
  const runningSet = new Set(shuffled.slice(0, runningCount).map(c => c.eqpId))

  // not-running 중 META_RATE% 에 MetaInfo 설정 (Stopped 상태)
  const notRunning = shuffled.slice(runningCount)
  const metaCount = Math.round(notRunning.length * META_RATE / 100)
  const metaSet = new Set(notRunning.slice(0, metaCount).map(c => c.eqpId))
  // running 에이전트도 MetaInfo 설정 (실제 환경과 동일)
  for (const c of shuffled.slice(0, runningCount)) {
    metaSet.add(c.eqpId)
  }

  // ResourceAgent: 별도 running 셋 생성 (같은 rate 사용)
  const resShuffled = [...clients].sort(() => Math.random() - 0.5)
  const resRunningCount = Math.round(clients.length * RATE / 100)
  const resRunningSet = new Set(resShuffled.slice(0, resRunningCount).map(c => c.eqpId))
  const resNotRunning = resShuffled.slice(resRunningCount)
  const resMetaCount = Math.round(resNotRunning.length * META_RATE / 100)
  const resMetaSet = new Set(resNotRunning.slice(0, resMetaCount).map(c => c.eqpId))
  for (const c of resShuffled.slice(0, resRunningCount)) resMetaSet.add(c.eqpId)

  const pipeline = redis.pipeline()
  const versionMap = {} // eqpId → version (출력용)
  const resVersionMap = {} // eqpId → ResourceAgent version
  const resHealthMap = {} // eqpId → health state
  for (const c of clients) {
    // --- ARSAgent ---
    const key = buildKey(c.process, c.eqpModel, c.eqpId)
    if (runningSet.has(c.eqpId)) {
      const uptime = Math.floor(Math.random() * 86340) + 60
      pipeline.set(key, String(uptime), 'EX', TTL)
    } else {
      pipeline.del(key)
    }

    // AgentMetaInfo Hash 설정
    const metaKey = buildMetaInfoKey(c.process, c.eqpModel)
    if (metaSet.has(c.eqpId)) {
      const ver = randomVersion()
      versionMap[c.eqpId] = ver
      pipeline.hset(metaKey, c.eqpId, ver + ':7180:' + c.eqpId + ':127.0.0.1:1')
    } else {
      pipeline.hdel(metaKey, c.eqpId)
    }

    // --- ResourceAgent ---
    const resHealthKey = buildResourceAgentHealthKey(c.process, c.eqpModel, c.eqpId)
    if (resRunningSet.has(c.eqpId)) {
      const uptime = Math.floor(Math.random() * 86340) + 60
      const health = randomHealthState()
      const reason = health === 'WARN' ? 'high_cpu' : null
      const val = reason ? `${health}:${uptime}:${reason}` : `${health}:${uptime}`
      pipeline.set(resHealthKey, val, 'EX', TTL)
      resHealthMap[c.eqpId] = health
    } else {
      pipeline.del(resHealthKey)
    }

    // ResourceAgentMetaInfo Hash 설정
    const resMetaKey = buildResourceAgentMetaInfoKey(c.process, c.eqpModel)
    if (resMetaSet.has(c.eqpId)) {
      const ver = randomResVersion()
      resVersionMap[c.eqpId] = ver
      pipeline.hset(resMetaKey, c.eqpId, ver + ':7180:' + c.eqpId + ':127.0.0.1:1')
    } else {
      pipeline.hdel(resMetaKey, c.eqpId)
    }
  }
  await pipeline.exec()

  // 집계
  const summary = {}
  const versionSummary = {} // 전체 버전별 카운트
  let totalStopped = 0
  let totalNeverStarted = 0
  for (const c of clients) {
    if (!summary[c.process]) summary[c.process] = { total: 0, running: 0, stopped: 0, neverStarted: 0, versions: {} }
    summary[c.process].total++
    if (runningSet.has(c.eqpId)) {
      summary[c.process].running++
    } else if (metaSet.has(c.eqpId)) {
      summary[c.process].stopped++
      totalStopped++
    } else {
      summary[c.process].neverStarted++
      totalNeverStarted++
    }
    // 버전 집계
    const ver = versionMap[c.eqpId] || 'Unknown'
    summary[c.process].versions[ver] = (summary[c.process].versions[ver] || 0) + 1
    versionSummary[ver] = (versionSummary[ver] || 0) + 1
  }

  const now = new Date().toLocaleTimeString()
  console.log(`[${now}] === ARSAgent 시뮬레이션 결과 ===`)
  console.log('─'.repeat(65))
  console.log(`${'TOTAL'.padEnd(14)} ${String(runningCount).padStart(7)} ${String(totalStopped).padStart(7)} ${String(totalNeverStarted).padStart(7)} / ${String(clients.length).padStart(5)}`)
  console.log('─'.repeat(65))
  console.log(`${'Process'.padEnd(14)} ${'Running'.padStart(7)} ${'Stopped'.padStart(7)} ${'NoStart'.padStart(7)} / ${'Total'.padStart(5)}`)
  console.log('─'.repeat(65))

  const sortedProcesses = Object.keys(summary).sort()
  for (const proc of sortedProcesses) {
    const s = summary[proc]
    console.log(`${proc.padEnd(14)} ${String(s.running).padStart(7)} ${String(s.stopped).padStart(7)} ${String(s.neverStarted).padStart(7)} / ${String(s.total).padStart(5)}`)
  }

  console.log(`TTL: ${TTL}초`)

  // 버전 분포 출력
  console.log('')
  console.log('ARSAgent 버전 분포:')
  console.log('─'.repeat(40))
  const sortedVersions = Object.entries(versionSummary).sort((a, b) => b[1] - a[1])
  for (const [ver, count] of sortedVersions) {
    const pct = Math.round(count / clients.length * 100)
    console.log(`  ${ver.padEnd(14)} ${String(count).padStart(4)}  (${pct}%)`)
  }

  // ResourceAgent 집계
  const resSummary = {}
  const resVersionSummary = {}
  let resTotalOk = 0, resTotalWarn = 0, resTotalShutdown = 0, resTotalStopped = 0, resTotalNever = 0
  for (const c of clients) {
    if (!resSummary[c.process]) resSummary[c.process] = { total: 0, ok: 0, warn: 0, shutdown: 0, stopped: 0, neverStarted: 0 }
    resSummary[c.process].total++
    if (resRunningSet.has(c.eqpId)) {
      const h = resHealthMap[c.eqpId] || 'OK'
      if (h === 'WARN') { resSummary[c.process].warn++; resTotalWarn++ }
      else if (h === 'SHUTDOWN') { resSummary[c.process].shutdown++; resTotalShutdown++ }
      else { resSummary[c.process].ok++; resTotalOk++ }
    } else if (resMetaSet.has(c.eqpId)) {
      resSummary[c.process].stopped++; resTotalStopped++
    } else {
      resSummary[c.process].neverStarted++; resTotalNever++
    }
    const resVer = resVersionMap[c.eqpId] || 'Unknown'
    resVersionSummary[resVer] = (resVersionSummary[resVer] || 0) + 1
  }

  console.log('')
  console.log(`=== ResourceAgent 시뮬레이션 결과 ===`)
  console.log('─'.repeat(80))
  console.log(`${'TOTAL'.padEnd(14)} ${String(resTotalOk).padStart(5)} ${String(resTotalWarn).padStart(6)} ${String(resTotalShutdown).padStart(10)} ${String(resTotalStopped).padStart(7)} ${String(resTotalNever).padStart(7)} / ${String(clients.length).padStart(5)}`)
  console.log('─'.repeat(80))
  console.log(`${'Process'.padEnd(14)} ${'OK'.padStart(5)} ${'WARN'.padStart(6)} ${'SHUTDOWN'.padStart(10)} ${'Stopped'.padStart(7)} ${'NoStart'.padStart(7)} / ${'Total'.padStart(5)}`)
  console.log('─'.repeat(80))
  for (const proc of Object.keys(resSummary).sort()) {
    const s = resSummary[proc]
    console.log(`${proc.padEnd(14)} ${String(s.ok).padStart(5)} ${String(s.warn).padStart(6)} ${String(s.shutdown).padStart(10)} ${String(s.stopped).padStart(7)} ${String(s.neverStarted).padStart(7)} / ${String(s.total).padStart(5)}`)
  }

  console.log('')
  console.log('ResourceAgent 버전 분포:')
  console.log('─'.repeat(40))
  for (const [ver, count] of Object.entries(resVersionSummary).sort((a, b) => b[1] - a[1])) {
    const pct = Math.round(count / clients.length * 100)
    console.log(`  ${ver.padEnd(14)} ${String(count).padStart(4)}  (${pct}%)`)
  }
}

async function cleanup(redis) {
  redis.disconnect()
  await closeConnections()
}

main().catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
