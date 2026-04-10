/**
 * Seed script for Recovery by Category E2E testing.
 * Creates dummy data in RECOVERY_SUMMARY_BY_CATEGORY (EARS DB) and
 * RECOVERY_CATEGORY_MAP (WEB_MANAGER DB).
 *
 * Usage: node scripts/seedCategoryData.js
 */

const { MongoClient } = require('mongodb')
require('dotenv').config()

const EARS_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/EARS'
const WM_URI = process.env.WEBMANAGER_DB_URI || 'mongodb://localhost:27017/WEB_MANAGER'

const CATEGORIES = [
  { scCategory: 1, categoryName: 'PM', description: 'Preventive Maintenance' },
  { scCategory: 2, categoryName: 'Chamber Clean', description: 'Chamber cleaning scenarios' },
  { scCategory: 3, categoryName: 'Vision', description: 'Vision inspection' },
  { scCategory: 4, categoryName: 'Alarm', description: 'Alarm recovery' },
  { scCategory: 5, categoryName: 'Wafer Transfer', description: 'Wafer transfer recovery' }
]

const PROCESSES = ['CVD', 'ETCH', 'PHOTO', 'DIFF']
const MODELS = ['MODEL_A', 'MODEL_B']
const STATUSES = ['Success', 'Failed', 'Stopped', 'ScriptFailed', 'Skip']

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function generateStatusCounts() {
  const success = randomInt(50, 500)
  const failed = randomInt(0, 30)
  const stopped = randomInt(0, 10)
  const scriptFailed = randomInt(0, 5)
  const skip = randomInt(0, 15)
  return { Success: success, Failed: failed, Stopped: stopped, ScriptFailed: scriptFailed, Skip: skip }
}

async function seed() {
  const earsClient = new MongoClient(EARS_URI)
  const wmClient = new MongoClient(WM_URI)

  try {
    await earsClient.connect()
    await wmClient.connect()

    const earsDb = earsClient.db()
    const wmDb = wmClient.db()

    // 1. Seed RECOVERY_CATEGORY_MAP
    const catMapColl = wmDb.collection('RECOVERY_CATEGORY_MAP')
    await catMapColl.deleteMany({})
    const catDocs = CATEGORIES.map(c => ({
      ...c,
      updatedBy: 'seed',
      updatedAt: new Date()
    }))
    await catMapColl.insertMany(catDocs)
    console.log(`[RECOVERY_CATEGORY_MAP] Inserted ${catDocs.length} category mappings`)

    // 2. Seed RECOVERY_SUMMARY_BY_CATEGORY
    const summaryColl = earsDb.collection('RECOVERY_SUMMARY_BY_CATEGORY')
    await summaryColl.deleteMany({})

    const docs = []
    const now = new Date()

    // Generate 7 days of daily data + 24 hours of hourly data
    for (const period of ['daily', 'hourly']) {
      const bucketCount = period === 'daily' ? 7 : 24

      for (let i = 0; i < bucketCount; i++) {
        const bucket = new Date(now)
        if (period === 'daily') {
          bucket.setUTCDate(bucket.getUTCDate() - i)
          bucket.setUTCHours(0, 0, 0, 0)
        } else {
          bucket.setUTCHours(bucket.getUTCHours() - i, 0, 0, 0)
        }

        for (const process of PROCESSES) {
          for (const model of MODELS) {
            // Each category + Uncategorized (-1)
            const allCats = [...CATEGORIES.map(c => c.scCategory), -1]
            for (const scCategory of allCats) {
              const sc = generateStatusCounts()
              const total = Object.values(sc).reduce((a, b) => a + b, 0)
              docs.push({
                period,
                bucket,
                line: 'L01',
                process,
                model,
                scCategory,
                total,
                status_counts: sc,
                updated_at: new Date()
              })
            }
          }
        }
      }
    }

    await summaryColl.insertMany(docs)
    console.log(`[RECOVERY_SUMMARY_BY_CATEGORY] Inserted ${docs.length} summary documents`)

    // 3. Ensure index
    await summaryColl.createIndex(
      { period: 1, bucket: 1, line: 1, process: 1, model: 1, scCategory: 1 },
      { unique: true }
    )
    await catMapColl.createIndex({ scCategory: 1 }, { unique: true })
    console.log('[Indexes] Created')

    console.log('\nSeed complete! You can now test Recovery by Category page.')
  } catch (err) {
    console.error('Seed failed:', err)
    process.exit(1)
  } finally {
    await earsClient.close()
    await wmClient.close()
  }
}

seed()
