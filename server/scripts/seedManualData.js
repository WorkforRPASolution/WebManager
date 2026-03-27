/**
 * User Manual 스크린샷용 Mock 데이터 시드 스크립트
 *
 * 모든 페이지에 실감나는 데이터를 생성합니다.
 * 매뉴얼 작성 완료 후 --cleanup 으로 생성된 데이터를 삭제할 수 있습니다.
 *
 * Usage:
 *   node scripts/seedManualData.js              # 데이터 생성
 *   node scripts/seedManualData.js --cleanup    # 생성한 데이터 삭제
 *   node scripts/seedManualData.js --status     # 현재 데이터 상태 확인
 *
 * 생성되는 데이터 목록 (MANUAL_DATA_MANIFEST.md 참조):
 *   - EQP_INFO: 40대 장비 (4 Process × 2 Model × 5대)
 *   - ARS_USER_INFO: 15명 사용자
 *   - EMAIL_TEMPLATE_REPOSITORY: 8개 템플릿
 *   - WEBMANAGER_LOG: ~300건 (audit/auth/access/error/batch)
 *   - Redis: AgentRunning/AgentMetaInfo/AgentHealth 키
 *   - EQP_AUTO_RECOVERY: seedRecoveryData.js 연동
 */

require('dotenv').config()
const { connectDB, closeConnections, earsConnection, webManagerConnection } = require('../shared/db/connection')
const Redis = require('ioredis')

// ── CLI ──
const CLEANUP = process.argv.includes('--cleanup')
const STATUS = process.argv.includes('--status')

// ── 식별자: 이 스크립트가 생성한 데이터를 구분하기 위한 마커 ──
const MARKER = '_manual_seed_'

// ── Mock 데이터 정의 ──

const PROCESSES = ['CVD', 'ETCH', 'PHOTO', 'DIFF']
const MODELS = {
  CVD: ['CVD-100', 'CVD-200'],
  ETCH: ['ETCH-A', 'ETCH-B'],
  PHOTO: ['PHOTO-X', 'PHOTO-Y'],
  DIFF: ['DIFF-300', 'DIFF-400']
}
const LINES = ['LINE-1', 'LINE-2']
const ARS_VERSIONS = ['2.5.0', '2.5.1', '2.6.0']
const RES_VERSIONS = ['1.3.0', '1.3.1', '1.4.0']
const OS_VERSIONS = ['Windows 10', 'Windows 11', 'Windows Server 2019']
const HEALTH_STATES = ['OK', 'OK', 'OK', 'OK', 'WARN', 'SHUTDOWN'] // 67% OK

function generateEquipment() {
  const eqps = []
  let ipCounter = 10
  for (const proc of PROCESSES) {
    for (const model of MODELS[proc]) {
      for (let i = 1; i <= 5; i++) {
        const eqpId = `${proc}-${model}-${String(i).padStart(2, '0')}`
        eqps.push({
          eqpId,
          ipAddr: `192.168.${ipCounter}.${100 + i}`,
          line: LINES[i % 2],
          lineDesc: `${LINES[i % 2]} Area`,
          process: proc,
          eqpModel: model,
          category: 'Production',
          agentPorts: { rpc: 7180, ftp: 7181, socks: 30000 },
          basePath: `C:\\ARS\\${proc}`,
          agentVersion: {
            arsAgent: ARS_VERSIONS[i % 3],
            resourceAgent: RES_VERSIONS[i % 3]
          },
          localpc: 0,
          emailcategory: `${proc}_DEFAULT`,
          osVer: OS_VERSIONS[i % 3],
          onoff: 1,
          webmanagerUse: 1,
          serviceType: 'win_sc',
          installdate: '2025-01-15',
          note: MARKER // 마커로 구분
        })
      }
      ipCounter++
    }
  }
  return eqps
}

function generateUsers() {
  const users = []
  const roles = [
    { singleid: 'conductor01', name: '김공정', authorityManager: 2, process: 'CVD;ETCH', dept: '공정기술팀' },
    { singleid: 'conductor02', name: '이장비', authorityManager: 2, process: 'PHOTO;DIFF', dept: '공정기술팀' },
    { singleid: 'manager01', name: '박관리', authorityManager: 3, process: 'CVD', dept: '설비관리팀' },
    { singleid: 'manager02', name: '최운영', authorityManager: 3, process: 'ETCH', dept: '설비관리팀' },
    { singleid: 'user01', name: '정기술', authorityManager: 0, process: 'CVD', dept: '기술지원팀' },
    { singleid: 'user02', name: '한엔지', authorityManager: 0, process: 'ETCH', dept: '기술지원팀' },
    { singleid: 'user03', name: '강오퍼', authorityManager: 0, process: 'PHOTO', dept: '운영팀' },
    { singleid: 'user04', name: '윤작업', authorityManager: 0, process: 'DIFF', dept: '운영팀' },
    { singleid: 'user05', name: '임현장', authorityManager: 0, process: 'CVD;ETCH;PHOTO', dept: '현장지원팀' },
    { singleid: 'user06', name: '송품질', authorityManager: 0, process: 'DIFF', dept: '품질관리팀' },
    { singleid: 'user07', name: '오분석', authorityManager: 0, process: 'CVD', dept: '분석팀' },
    { singleid: 'user08', name: '서개발', authorityManager: 0, process: 'ETCH', dept: '개발팀' },
    { singleid: 'user09', name: '신보전', authorityManager: 0, process: 'PHOTO;DIFF', dept: '보전팀' },
    { singleid: 'user10', name: '유안전', authorityManager: 0, process: 'CVD', dept: '안전환경팀' },
    { singleid: 'user_pending', name: '조대기', authorityManager: 0, process: 'CVD', dept: '신규입사', accountStatus: 'pending' },
  ]

  for (const r of roles) {
    const procs = r.process.split(';')
    users.push({
      singleid: r.singleid,
      name: r.name,
      password: '$2b$12$LJ3a0/HvB5.oYxN5s5PVNOhR7P0jM.ZIGmZp0RdCjqfKA5N4O6G2a', // 'Test1234'
      line: LINES[0],
      process: r.process,
      processes: procs,
      authority: r.authorityManager <= 2 ? 'WRITE' : '',
      authorityManager: r.authorityManager,
      note: MARKER,
      department: r.dept,
      accountStatus: r.accountStatus || 'active',
      passwordStatus: 'normal',
      accessnum: Math.floor(Math.random() * 200) + 10,
      accessnum_desktop: Math.floor(Math.random() * 50),
      latestExecution: randomDate(30).toISOString(),
      webmanagerLoginInfo: {
        lastLoginAt: randomDate(7),
        loginCount: Math.floor(Math.random() * 100) + 5
      }
    })
  }
  return users
}

function generateEmailTemplates() {
  return [
    { app: 'ARS', process: 'CVD', model: 'CVD-100', code: 'RECOVERY', subcode: 'SUCCESS', title: 'Recovery 성공 알림', html: `<html><body><h2>Recovery 완료</h2><p>장비 {{eqpId}}의 Recovery가 성공적으로 완료되었습니다.</p><p>시나리오: {{scenario}}</p><p>시간: {{timestamp}}</p><p style="color:green">상태: 정상</p><p>${MARKER}</p></body></html>` },
    { app: 'ARS', process: 'CVD', model: 'CVD-100', code: 'RECOVERY', subcode: 'FAIL', title: 'Recovery 실패 알림', html: `<html><body><h2 style="color:red">Recovery 실패</h2><p>장비 {{eqpId}}의 Recovery가 실패했습니다.</p><p>시나리오: {{scenario}}</p><p>오류: {{errorMsg}}</p><p>${MARKER}</p></body></html>` },
    { app: 'ARS', process: 'CVD', model: 'CVD-200', code: 'ALARM', subcode: 'CRITICAL', title: 'Critical 알람 발생', html: `<html><body><h2 style="color:red">Critical Alarm</h2><p>장비: {{eqpId}}</p><p>알람 코드: {{alarmCode}}</p><p>발생 시간: {{timestamp}}</p><p>${MARKER}</p></body></html>` },
    { app: 'ARS', process: 'ETCH', model: 'ETCH-A', code: 'RECOVERY', subcode: 'SUCCESS', title: 'ETCH Recovery 성공', html: `<html><body><h2>ETCH Recovery 완료</h2><p>{{eqpId}} 장비 Recovery 성공</p><p>${MARKER}</p></body></html>` },
    { app: 'ARS', process: 'ETCH', model: 'ETCH-B', code: 'REPORT', subcode: 'DAILY', title: '일일 보고서', html: `<html><body><h1>Daily Report</h1><p>Date: {{date}}</p><table border="1"><tr><th>공정</th><th>가동률</th></tr><tr><td>ETCH</td><td>95.2%</td></tr></table><p>${MARKER}</p></body></html>` },
    { app: 'ARS', process: 'PHOTO', model: 'PHOTO-X', code: 'ALARM', subcode: 'WARNING', title: 'Warning 알람 발생', html: `<html><body><h2 style="color:orange">Warning Alarm</h2><p>{{eqpId}}: {{alarmMsg}}</p><p>${MARKER}</p></body></html>` },
    { app: 'ARS', process: 'DIFF', model: 'DIFF-300', code: 'RECOVERY', subcode: 'SUCCESS', title: 'DIFF Recovery 성공', html: `<html><body><h2>Recovery 완료</h2><p>{{eqpId}} 장비의 Recovery가 성공했습니다.</p><p>${MARKER}</p></body></html>` },
    { app: 'ARS', process: 'DIFF', model: 'DIFF-400', code: 'MAINT', subcode: 'SCHEDULE', title: '정기 점검 안내', html: `<html><body><h1>정기 점검 안내</h1><p>일시: {{date}}</p><p>대상: {{eqpModel}} 전체</p><p>담당: {{assignee}}</p><p>${MARKER}</p></body></html>` },
  ]
}

function generateWebManagerLogs() {
  const logs = []
  const now = new Date()

  // Audit logs (50건)
  const auditActions = ['create', 'update', 'delete', 'save', 'deploy']
  const collections = ['EQP_INFO', 'ARS_USER_INFO', 'EMAIL_TEMPLATE_REPOSITORY', 'CONFIG_SETTINGS']
  for (let i = 0; i < 50; i++) {
    logs.push({
      category: 'audit',
      timestamp: randomDate(30),
      userId: ['admin', 'conductor01', 'manager01'][i % 3],
      collectionName: collections[i % collections.length],
      documentId: `doc-${i}`,
      action: auditActions[i % auditActions.length],
      changes: i % 3 === 0 ? { process: { from: 'CVD', to: 'ETCH' } } : undefined,
      details: MARKER,
      expireAt: new Date(now.getTime() + 730 * 86400000)
    })
  }

  // Auth logs (80건)
  const authActions = ['login', 'login', 'login', 'logout', 'login_failed', 'signup', 'password_changed']
  const userIds = ['admin', 'conductor01', 'conductor02', 'manager01', 'user01', 'user02', 'user03']
  for (let i = 0; i < 80; i++) {
    logs.push({
      category: 'auth',
      timestamp: randomDate(14),
      userId: userIds[i % userIds.length],
      authAction: authActions[i % authActions.length],
      ipAddress: `192.168.1.${100 + (i % 20)}`,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0',
      details: MARKER,
      expireAt: new Date(now.getTime() + 365 * 86400000)
    })
  }

  // Access logs (100건)
  const pages = [
    { path: '/', name: 'DashboardOverview' },
    { path: '/agent-monitor', name: 'AgentMonitor' },
    { path: '/recovery-overview', name: 'RecoveryOverview' },
    { path: '/clients', name: 'Clients' },
    { path: '/equipment-info', name: 'EquipmentInfo' },
    { path: '/email-template', name: 'EmailTemplate' },
    { path: '/users', name: 'UserManagement' },
    { path: '/permissions', name: 'Permissions' },
    { path: '/system-logs', name: 'SystemLogs' },
    { path: '/help', name: 'UserManual' },
  ]
  for (let i = 0; i < 100; i++) {
    const page = pages[i % pages.length]
    const enter = randomDate(7)
    const duration = Math.floor(Math.random() * 300000) + 5000 // 5s ~ 5min
    logs.push({
      category: 'access',
      timestamp: enter,
      userId: userIds[i % userIds.length],
      pagePath: page.path,
      pageName: page.name,
      enterTime: enter,
      leaveTime: new Date(enter.getTime() + duration),
      durationMs: duration,
      details: MARKER,
      expireAt: new Date(now.getTime() + 90 * 86400000)
    })
  }

  // Error logs (20건)
  for (let i = 0; i < 20; i++) {
    logs.push({
      category: 'error',
      timestamp: randomDate(14),
      userId: 'system',
      errorType: ['FTPConnectionError', 'RPCTimeout', 'MongoNetworkError', 'RedisConnectionError'][i % 4],
      errorMessage: ['FTP connection refused', 'RPC call timed out after 10s', 'MongoDB connection lost', 'Redis ECONNREFUSED'][i % 4],
      errorStack: 'Error: ...\n    at Object.<anonymous>',
      requestInfo: { method: 'GET', url: `/api/clients/${i}` },
      details: MARKER,
      expireAt: new Date(now.getTime() + 90 * 86400000)
    })
  }

  // Batch logs (50건)
  const batchActions = ['cron_completed', 'cron_completed', 'cron_skipped', 'cron_failed']
  for (let i = 0; i < 50; i++) {
    logs.push({
      category: 'batch',
      timestamp: randomDate(14),
      userId: 'system',
      batchAction: batchActions[i % batchActions.length],
      batchPeriod: i % 2 === 0 ? 'hourly' : 'daily',
      batchParams: { type: 'recovery_summary' },
      batchResult: { inserted: Math.floor(Math.random() * 100), duration: Math.floor(Math.random() * 5000) },
      details: MARKER,
      expireAt: new Date(now.getTime() + 365 * 86400000)
    })
  }

  return logs
}

function randomDate(daysBack) {
  const now = Date.now()
  return new Date(now - Math.floor(Math.random() * daysBack * 86400000))
}

// ── Redis 데이터 생성 ──
async function seedRedis(eqps) {
  const url = process.env.REDIS_URL
  if (!url) { console.log('  ⚠ REDIS_URL not set, skipping Redis seed'); return }

  const redis = new Redis(url, { maxRetriesPerRequest: 3, lazyConnect: true })
  await redis.connect()

  const pipe = redis.pipeline()
  const TTL = 600 // 10분

  for (const eqp of eqps) {
    const { process, eqpModel, eqpId } = eqp
    const key = `${process}-${eqpModel}-${eqpId}`
    const uptime = Math.floor(Math.random() * 86400) + 3600
    const arsVer = eqp.agentVersion.arsAgent
    const resVer = eqp.agentVersion.resourceAgent

    // 85% Running (Stopped/NeverStarted 섞기)
    const isRunning = Math.random() < 0.85

    if (isRunning) {
      // ARSAgent
      pipe.set(`AgentRunning:${key}`, String(uptime), 'EX', TTL)
      pipe.set(`AgentHealth:ars_agent:${key}`, String(uptime), 'EX', TTL)
      pipe.hset(`AgentMetaInfo:${process}-${eqpModel}`, eqpId, `${arsVer}:7180:${eqpId}:${eqp.ipAddr}:1`)

      // ResourceAgent (80% of running have resource agent)
      if (Math.random() < 0.80) {
        const healthState = HEALTH_STATES[Math.floor(Math.random() * HEALTH_STATES.length)]
        pipe.set(`AgentHealth:resource_agent:${key}`, `${healthState}:${uptime}`, 'EX', TTL)
        pipe.hset(`ResourceAgentMetaInfo:${process}-${eqpModel}`, eqpId, `${resVer}:7180:${eqpId}:${eqp.ipAddr}:1`)
      }
    } else {
      // Stopped: has MetaInfo but no Running key
      if (Math.random() < 0.7) {
        pipe.hset(`AgentMetaInfo:${process}-${eqpModel}`, eqpId, `${arsVer}:7180:${eqpId}:${eqp.ipAddr}:1`)
      }
      // else NeverStarted: no keys at all
    }
  }

  await pipe.exec()
  await redis.quit()
  console.log(`  ✅ Redis: ${eqps.length} 장비 Agent 상태 설정 (TTL ${TTL}초)`)
}

async function cleanupRedis(eqps) {
  const url = process.env.REDIS_URL
  if (!url) return

  const redis = new Redis(url, { maxRetriesPerRequest: 3, lazyConnect: true })
  await redis.connect()

  const pipe = redis.pipeline()
  for (const eqp of eqps) {
    const { process, eqpModel, eqpId } = eqp
    const key = `${process}-${eqpModel}-${eqpId}`
    pipe.del(`AgentRunning:${key}`)
    pipe.del(`AgentHealth:ars_agent:${key}`)
    pipe.del(`AgentHealth:resource_agent:${key}`)
    pipe.hdel(`AgentMetaInfo:${process}-${eqpModel}`, eqpId)
    pipe.hdel(`ResourceAgentMetaInfo:${process}-${eqpModel}`, eqpId)
  }
  await pipe.exec()
  await redis.quit()
  console.log('  ✅ Redis keys cleaned')
}

// ── Main ──
async function main() {
  await connectDB()

  const mongoose = require('mongoose')

  // 모델이 이미 등록되어 있으면 재사용, 아니면 스키마로 생성
  function getModel(connection, name, source) {
    try { return connection.model(name) } catch (_) {}
    if (typeof source === 'function' && source.schema) return connection.model(name, source.schema)
    if (source && source.schema) return connection.model(name, source.schema)
    return connection.model(name, source)
  }

  // 이미 등록된 Mongoose 모델 직접 사용
  const EqpInfo = require('../features/clients/model')
  const UserInfo = require('../features/users/model').User
  const EmailTemplate = require('../features/email-template/model')
  const WebManagerLog = require('../shared/models/webmanagerLogModel').WebManagerLog

  const eqps = generateEquipment()

  if (STATUS) {
    const eqpCount = await EqpInfo.countDocuments({ note: MARKER })
    const userCount = await UserInfo.countDocuments({ note: MARKER })
    const templateCount = await EmailTemplate.countDocuments({ html: { $regex: MARKER } })
    const logCount = await WebManagerLog.countDocuments({ details: MARKER })
    console.log('\n📊 Manual Seed 데이터 상태:')
    console.log(`  EQP_INFO:        ${eqpCount}건`)
    console.log(`  ARS_USER_INFO:   ${userCount}건`)
    console.log(`  EMAIL_TEMPLATE:  ${templateCount}건`)
    console.log(`  WEBMANAGER_LOG:  ${logCount}건`)
    console.log(`  Redis:           simulateAgentStatus.js --list 로 확인`)
    await closeConnections()
    return
  }

  if (CLEANUP) {
    console.log('\n🧹 Manual Seed 데이터 삭제 중...')
    const r1 = await EqpInfo.deleteMany({ note: MARKER })
    console.log(`  ✅ EQP_INFO: ${r1.deletedCount}건 삭제`)
    const r2 = await UserInfo.deleteMany({ note: MARKER })
    console.log(`  ✅ ARS_USER_INFO: ${r2.deletedCount}건 삭제`)
    const r3 = await EmailTemplate.deleteMany({ html: { $regex: MARKER } })
    console.log(`  ✅ EMAIL_TEMPLATE: ${r3.deletedCount}건 삭제`)
    const r4 = await WebManagerLog.deleteMany({ details: MARKER })
    console.log(`  ✅ WEBMANAGER_LOG: ${r4.deletedCount}건 삭제`)
    await cleanupRedis(eqps)
    console.log('\n✅ 정리 완료!')
    await closeConnections()
    return
  }

  console.log('\n🌱 Manual Seed 데이터 생성 중...\n')

  // 1. EQP_INFO
  // 기존 시드 데이터 정리 후 삽입
  await EqpInfo.deleteMany({ note: MARKER })
  await EqpInfo.insertMany(eqps, { ordered: false }).catch(e => {
    if (e.code === 11000) console.log('  ⚠ 일부 EQP_INFO 중복 스킵')
    else throw e
  })
  console.log(`  ✅ EQP_INFO: ${eqps.length}건 생성`)

  // 2. ARS_USER_INFO
  const users = generateUsers()
  await UserInfo.deleteMany({ note: MARKER })
  await UserInfo.insertMany(users, { ordered: false }).catch(e => {
    if (e.code === 11000) console.log('  ⚠ 일부 사용자 중복 스킵')
    else throw e
  })
  console.log(`  ✅ ARS_USER_INFO: ${users.length}건 생성`)

  // 3. EMAIL_TEMPLATE_REPOSITORY
  const templates = generateEmailTemplates()
  await EmailTemplate.deleteMany({ html: { $regex: MARKER } })
  await EmailTemplate.insertMany(templates, { ordered: false }).catch(e => {
    if (e.code === 11000) console.log('  ⚠ 일부 템플릿 중복 스킵')
    else throw e
  })
  console.log(`  ✅ EMAIL_TEMPLATE: ${templates.length}건 생성`)

  // 4. WEBMANAGER_LOG
  const logs = generateWebManagerLogs()
  await WebManagerLog.deleteMany({ details: MARKER })
  await WebManagerLog.insertMany(logs)
  console.log(`  ✅ WEBMANAGER_LOG: ${logs.length}건 생성`)

  // 5. Redis (Agent Status)
  await seedRedis(eqps)

  console.log('\n✅ 전체 시드 완료!')
  console.log('\n📋 생성된 데이터 요약:')
  console.log(`  EQP_INFO:        ${eqps.length}건 (${PROCESSES.join('/')} × 2모델 × 5대)`)
  console.log(`  ARS_USER_INFO:   ${users.length}건 (Admin/Conductor/Manager/User)`)
  console.log(`  EMAIL_TEMPLATE:  ${templates.length}건 (Recovery/Alarm/Report/Maint)`)
  console.log(`  WEBMANAGER_LOG:  ${logs.length}건 (audit 50 + auth 80 + access 100 + error 20 + batch 50)`)
  console.log(`  Redis:           AgentRunning/Health/MetaInfo (85% Running, TTL 600초)`)
  console.log('\n⚠  Redis TTL은 10분이므로 스크린샷 캡처 전 재실행 필요: node scripts/seedManualData.js')
  console.log('🧹 정리: node scripts/seedManualData.js --cleanup')

  await closeConnections()
}

main().catch(e => { console.error(e); process.exit(1) })
