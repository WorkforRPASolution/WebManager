/**
 * Seed today's RECOVERY_SUMMARY_BY_CATEGORY + RECOVERY_CATEGORY_MAP
 * KST 기준 오늘 하루: hourly 버킷(00~현재) + daily 1건
 *
 * Usage: node scripts/seedCategoryToday.js
 */

const { MongoClient } = require('mongodb')
require('dotenv').config()

const EARS_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/EARS'
const WM_URI = process.env.WEBMANAGER_DB_URI || 'mongodb://localhost:27017/WEB_MANAGER'

// ── 카테고리 10개 + Uncategorized ──
const CATEGORIES = [
  { scCategory: 1, categoryName: 'PM', description: 'Preventive Maintenance' },
  { scCategory: 2, categoryName: 'Chamber Clean', description: 'Chamber cleaning scenarios' },
  { scCategory: 3, categoryName: 'Vision Inspect', description: 'Vision inspection recovery' },
  { scCategory: 4, categoryName: 'Alarm Recovery', description: 'Alarm-triggered recovery' },
  { scCategory: 5, categoryName: 'Wafer Transfer', description: 'Wafer transfer recovery' },
  { scCategory: 6, categoryName: 'Gas Control', description: 'Gas supply/exhaust control' },
  { scCategory: 7, categoryName: 'Temperature', description: 'Temperature regulation' },
  { scCategory: 8, categoryName: 'Pressure Control', description: 'Pressure control recovery' },
  { scCategory: 9, categoryName: 'RF Tuning', description: 'RF power tuning' },
  { scCategory: 10, categoryName: 'Vacuum System', description: 'Vacuum pump/valve recovery' }
]

// ── 공정 / 모델 ──
const PROCESS_MODELS = {
  ETCH:  { line: 'L01', models: ['ET_DRY', 'ET_WET', 'ET_PLASMA'] },
  PHOTO: { line: 'L01', models: ['PH_SCAN', 'PH_COAT', 'PH_DEV'] },
  CVD:   { line: 'L02', models: ['CVD_PE', 'CVD_LP'] },
  DIFF:  { line: 'L02', models: ['DF_OX', 'DF_AN'] },
  CMP:   { line: 'L03', models: ['CMP_CU', 'CMP_OX'] },
  IMP:   { line: 'L03', models: ['IMP_HI', 'IMP_MED'] },
  MET:   { line: 'L04', models: ['MET_SP', 'MET_PVD'] },
  CLEAN: { line: 'L05', models: ['CL_WET', 'CL_DRY'] }
}

// 카테고리별 실행 비중 (scCategory → weight)
// PM/Chamber Clean이 가장 많고, RF Tuning/Vacuum은 적음
const CATEGORY_WEIGHTS = {
  1: 8, 2: 7, 3: 6, 4: 5, 5: 4, 6: 3, 7: 3, 8: 2, 9: 1, 10: 1, '-1': 2
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function generateStatusCounts(weight) {
  const base = weight * 10
  const success = randomInt(base, base * 3)
  const failed = randomInt(0, Math.max(1, Math.floor(base * 0.15)))
  const stopped = randomInt(0, Math.max(1, Math.floor(base * 0.05)))
  const scriptFailed = randomInt(0, Math.max(1, Math.floor(base * 0.03)))
  const skip = randomInt(0, Math.max(1, Math.floor(base * 0.08)))
  return { Success: success, Failed: failed, Stopped: stopped, ScriptFailed: scriptFailed, Skip: skip }
}

function kstMidnightUTC(date) {
  // KST 자정 = UTC -9h
  const d = new Date(date)
  d.setUTCHours(0, 0, 0, 0)
  // KST offset
  const kstDate = new Date(d.getTime() + 9 * 60 * 60 * 1000)
  kstDate.setUTCHours(0, 0, 0, 0)
  return new Date(kstDate.getTime() - 9 * 60 * 60 * 1000)
}

async function seed() {
  const earsClient = new MongoClient(EARS_URI)
  const wmClient = new MongoClient(WM_URI)

  try {
    await earsClient.connect()
    await wmClient.connect()
    console.log('Connected to EARS & WEB_MANAGER')

    const earsDb = earsClient.db()
    const wmDb = wmClient.db()

    // ── 1. RECOVERY_CATEGORY_MAP (upsert) ──
    const catMapColl = wmDb.collection('RECOVERY_CATEGORY_MAP')
    for (const cat of CATEGORIES) {
      await catMapColl.updateOne(
        { scCategory: cat.scCategory },
        { $set: { ...cat, updatedBy: 'seed', updatedAt: new Date() } },
        { upsert: true }
      )
    }
    await catMapColl.createIndex({ scCategory: 1 }, { unique: true }).catch(() => {})
    console.log(`[CATEGORY_MAP] Upserted ${CATEGORIES.length} categories`)

    // ── 2. RECOVERY_SUMMARY_BY_CATEGORY ──
    const summaryColl = earsDb.collection('RECOVERY_SUMMARY_BY_CATEGORY')

    // KST 기준 오늘 자정
    const now = new Date()
    const todayMidnight = kstMidnightUTC(now)
    // 현재 KST 시간
    const kstNowHour = new Date(now.getTime() + 9 * 60 * 60 * 1000).getUTCHours()

    const allCats = [...CATEGORIES.map(c => c.scCategory), -1]
    const docs = []

    // hourly 버킷: 00시 ~ 현재시
    for (let h = 0; h <= kstNowHour; h++) {
      const bucket = new Date(todayMidnight.getTime() + h * 60 * 60 * 1000)

      for (const [process, { line, models }] of Object.entries(PROCESS_MODELS)) {
        for (const model of models) {
          for (const scCategory of allCats) {
            const weight = CATEGORY_WEIGHTS[scCategory] || 1
            const sc = generateStatusCounts(weight)
            const total = Object.values(sc).reduce((a, b) => a + b, 0)
            docs.push({
              period: 'hourly', bucket, line, process, model,
              scCategory, total, status_counts: sc, updated_at: new Date()
            })
          }
        }
      }
    }

    // daily 버킷: 오늘 1건
    for (const [process, { line, models }] of Object.entries(PROCESS_MODELS)) {
      for (const model of models) {
        for (const scCategory of allCats) {
          const weight = CATEGORY_WEIGHTS[scCategory] || 1
          // daily는 hourly 합산 느낌으로 더 큰 값
          const sc = generateStatusCounts(weight * (kstNowHour + 1))
          const total = Object.values(sc).reduce((a, b) => a + b, 0)
          docs.push({
            period: 'daily', bucket: todayMidnight, line, process, model,
            scCategory, total, status_counts: sc, updated_at: new Date()
          })
        }
      }
    }

    // 오늘 데이터만 삭제 후 삽입
    await summaryColl.deleteMany({
      bucket: { $gte: todayMidnight, $lt: new Date(todayMidnight.getTime() + 24 * 60 * 60 * 1000) }
    })
    await summaryColl.insertMany(docs, { ordered: false })
    await summaryColl.createIndex(
      { period: 1, bucket: 1, line: 1, process: 1, model: 1, scCategory: 1 },
      { unique: true }
    ).catch(() => {})

    const hourlyCount = docs.filter(d => d.period === 'hourly').length
    const dailyCount = docs.filter(d => d.period === 'daily').length
    console.log(`[SUMMARY_BY_CATEGORY] Inserted ${docs.length} docs (hourly: ${hourlyCount}, daily: ${dailyCount})`)
    console.log(`  Processes: ${Object.keys(PROCESS_MODELS).join(', ')}`)
    console.log(`  Categories: ${CATEGORIES.map(c => c.categoryName).join(', ')} + Uncategorized`)
    console.log(`  Hourly buckets: 00:00 ~ ${String(kstNowHour).padStart(2, '0')}:00 KST`)

    console.log('\nSeed complete!')
  } catch (err) {
    console.error('Seed failed:', err)
    process.exit(1)
  } finally {
    await earsClient.close()
    await wmClient.close()
  }
}

seed()
