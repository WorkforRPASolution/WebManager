/**
 * Seed script for EQP_AUTO_RECOVERY collection
 * Generates test documents for Recovery Dashboard development.
 *
 * Run: node scripts/seedRecoveryData.js [options]
 *
 * Options:
 *   --count <n>       Number of documents (default: 75000)
 *   --days <n>        Date range in days (default: 30)
 *   --batch-size <n>  Insert batch size (default: 5000)
 *   --with-indexes    Create indexes after seeding
 *   --reset           Drop existing collection first
 */

require('dotenv').config()
const { connectDB, closeConnections, earsConnection } = require('../shared/db/connection')

// ── CLI argument parsing ──

function parseArgs() {
  const args = process.argv.slice(2)
  const opts = {
    count: 75000,
    days: 30,
    batchSize: 5000,
    withIndexes: false,
    reset: false
  }

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--count':
        opts.count = parseInt(args[++i], 10)
        break
      case '--days':
        opts.days = parseInt(args[++i], 10)
        break
      case '--batch-size':
        opts.batchSize = parseInt(args[++i], 10)
        break
      case '--with-indexes':
        opts.withIndexes = true
        break
      case '--reset':
        opts.reset = true
        break
    }
  }

  return opts
}

// ── Data generators ──

const LINES = ['L01', 'L02', 'L03', 'L04', 'L05']

const PROCESSES = ['ETCH', 'PHOTO', 'CVD', 'DIFF', 'CMP', 'IMP', 'MET', 'CLEAN', 'PKG', 'TEST']

const MODELS_PER_PROCESS = {
  ETCH: ['ET_DRY', 'ET_WET', 'ET_PLASMA'],
  PHOTO: ['PH_SCAN', 'PH_STEP', 'PH_COAT', 'PH_DEV'],
  CVD: ['CVD_PE', 'CVD_LP', 'CVD_ALD'],
  DIFF: ['DF_OXI', 'DF_ANN', 'DF_RTP', 'DF_FUR'],
  CMP: ['CMP_A', 'CMP_B', 'CMP_C'],
  IMP: ['IMP_HI', 'IMP_MD', 'IMP_LO', 'IMP_UL'],
  MET: ['MET_SP', 'MET_EV', 'MET_PL'],
  CLEAN: ['CLN_SC1', 'CLN_SC2', 'CLN_DHF', 'CLN_SPM', 'CLN_DRY'],
  PKG: ['PKG_WB', 'PKG_FC', 'PKG_ML'],
  TEST: ['TST_FT', 'TST_CP', 'TST_BI']
}

const TRIGGER_BY = ['Log', 'Scheduler', 'Status', 'SE', 'Scenario', 'Unknown', 'External_API']

const STATUSES = [
  // ~70% Success
  ...Array(70).fill('Success'),
  // ~10% Failed
  ...Array(10).fill('Failed'),
  // ~5% Stopped
  ...Array(5).fill('Stopped'),
  // ~5% Skip
  ...Array(5).fill('Skip'),
  // rest split among others
  'ScriptFailed', 'ScriptFailed',
  'VisionDelayed', 'VisionDelayed',
  'NotStarted',
  'Wait',
  'StartPending',
  'Retry',
  'Unknown'
]

const KST_OFFSET_MS = 9 * 60 * 60 * 1000

/**
 * Generate a random KST ISO 8601 date string within the given range,
 * weighted toward business hours (7~19 KST).
 */
function randomKSTDate(nowMs, daysBack) {
  const rangeMs = daysBack * 24 * 60 * 60 * 1000
  const startMs = nowMs - rangeMs

  // Pick a random point in the range
  let ts = startMs + Math.random() * rangeMs

  // Weight toward business hours: 70% chance to be in 7:00~19:00 KST
  if (Math.random() < 0.7) {
    const kstMs = ts + KST_OFFSET_MS
    const kst = new Date(kstMs)
    // Set hour to business hours (7-18)
    kst.setUTCHours(7 + Math.floor(Math.random() * 12))
    kst.setUTCMinutes(Math.floor(Math.random() * 60))
    kst.setUTCSeconds(Math.floor(Math.random() * 60))
    kst.setUTCMilliseconds(Math.floor(Math.random() * 1000))
    ts = kst.getTime() - KST_OFFSET_MS
  }

  return formatKST(new Date(ts))
}

function formatKST(date) {
  const kstMs = date.getTime() + KST_OFFSET_MS
  const kst = new Date(kstMs)
  const y = kst.getUTCFullYear()
  const M = String(kst.getUTCMonth() + 1).padStart(2, '0')
  const d = String(kst.getUTCDate()).padStart(2, '0')
  const h = String(kst.getUTCHours()).padStart(2, '0')
  const m = String(kst.getUTCMinutes()).padStart(2, '0')
  const s = String(kst.getUTCSeconds()).padStart(2, '0')
  const ms = String(kst.getUTCMilliseconds()).padStart(3, '0')
  return `${y}-${M}-${d}T${h}:${m}:${s}.${ms}+09:00`
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1))
}

/**
 * Generate a retry string like "0/0/10" or "1/2/10"
 */
function randomRetry() {
  const max = randomInt(5, 15)
  const attempt = randomInt(0, 3)
  const fail = Math.min(attempt, randomInt(0, attempt))
  return `${fail}/${attempt}/${max}`
}

/**
 * Pre-generate eqpId pools per (process, model) for consistent data.
 */
function buildEqpIdPools() {
  const pools = {}
  for (const process of PROCESSES) {
    const models = MODELS_PER_PROCESS[process]
    for (const model of models) {
      const count = randomInt(10, 20)
      const ids = []
      for (let i = 1; i <= count; i++) {
        ids.push(`${process}-${model}-${String(i).padStart(3, '0')}`)
      }
      pools[`${process}:${model}`] = ids
    }
  }
  return pools
}

function generateDocument(txnSeq, nowMs, days, eqpIdPools) {
  const line = pick(LINES)
  const process = pick(PROCESSES)
  const models = MODELS_PER_PROCESS[process]
  const model = pick(models)
  const eqpIds = eqpIdPools[`${process}:${model}`]
  const eqpId = pick(eqpIds)
  const earsCodeNum = randomInt(1, 100)
  const earsCode = `SC_${String(earsCodeNum).padStart(3, '0')}`

  return {
    txn_seq: txnSeq,
    line,
    process,
    model,
    eqpid: eqpId,
    ears_code: earsCode,
    trigger_by: pick(TRIGGER_BY),
    status: pick(STATUSES),
    retry: randomRetry(),
    params: {},
    create_date: randomKSTDate(nowMs, days)
  }
}

// ── Main ──

async function seed() {
  const opts = parseArgs()
  console.log('Seed options:', opts)

  try {
    await connectDB()
    const db = earsConnection.db
    const collection = db.collection('EQP_AUTO_RECOVERY')

    // Reset if requested
    if (opts.reset) {
      await collection.drop().catch(() => {}) // ignore if doesn't exist
      console.log('Dropped existing EQP_AUTO_RECOVERY collection')
    }

    // Pre-generate eqpId pools
    const eqpIdPools = buildEqpIdPools()
    const nowMs = Date.now()
    let inserted = 0

    console.log(`Generating ${opts.count} documents...`)
    const startTime = Date.now()

    // Insert in batches
    while (inserted < opts.count) {
      const batchSize = Math.min(opts.batchSize, opts.count - inserted)
      const batch = []

      for (let i = 0; i < batchSize; i++) {
        batch.push(generateDocument(inserted + i + 1, nowMs, opts.days, eqpIdPools))
      }

      await collection.insertMany(batch, { ordered: false })
      inserted += batchSize

      const pct = ((inserted / opts.count) * 100).toFixed(1)
      process.stdout.write(`\r  Inserted: ${inserted.toLocaleString()} / ${opts.count.toLocaleString()} (${pct}%)`)
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    console.log(`\n  Completed in ${elapsed}s`)

    // Create indexes if requested
    if (opts.withIndexes) {
      console.log('Creating indexes...')
      await collection.createIndex({ create_date: 1 })
      console.log('  Index: { create_date: 1 }')
      await collection.createIndex({ eqpid: 1, create_date: 1 })
      console.log('  Index: { eqpid: 1, create_date: 1 }')
      await collection.createIndex({ ears_code: 1, create_date: 1 })
      console.log('  Index: { ears_code: 1, create_date: 1 }')
      console.log('Indexes created')
    }

    // Verify
    const totalCount = await collection.countDocuments()
    console.log(`\nTotal documents in EQP_AUTO_RECOVERY: ${totalCount.toLocaleString()}`)

    await closeConnections()
    console.log('Done!')
  } catch (error) {
    console.error('Error seeding recovery data:', error)
    process.exit(1)
  }
}

seed()
