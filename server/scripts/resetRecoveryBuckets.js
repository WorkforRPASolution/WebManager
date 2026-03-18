/**
 * Reset Recovery Summary buckets and related logs.
 * Deletes all documents from:
 *   - RECOVERY_SUMMARY_BY_SCENARIO (EARS DB)
 *   - RECOVERY_SUMMARY_BY_EQUIPMENT (EARS DB)
 *   - RECOVERY_SUMMARY_BY_TRIGGER (EARS DB)
 *   - CRON_RUN_LOG (WEB_MANAGER DB)
 *   - WEBMANAGER_LOG category='batch' (WEB_MANAGER DB)
 *
 * Run: node scripts/resetRecoveryBuckets.js [options]
 *
 * Options:
 *   --yes           Skip confirmation prompt
 *   --keep-logs     Keep WEBMANAGER_LOG batch logs (only reset buckets + CRON_RUN_LOG)
 */

require('dotenv').config()
const readline = require('readline')
const { connectDB, closeConnections, earsConnection, webManagerConnection } = require('../shared/db/connection')

function parseArgs() {
  const args = process.argv.slice(2)
  return {
    yes: args.includes('--yes'),
    keepLogs: args.includes('--keep-logs')
  }
}

async function confirm(message) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise(resolve => {
    rl.question(message, answer => {
      rl.close()
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes')
    })
  })
}

async function main() {
  const opts = parseArgs()

  await connectDB()

  const earsDb = earsConnection.db
  const webManagerDb = webManagerConnection.db

  // Show current counts
  const summaryColls = [
    'RECOVERY_SUMMARY_BY_SCENARIO',
    'RECOVERY_SUMMARY_BY_EQUIPMENT',
    'RECOVERY_SUMMARY_BY_TRIGGER'
  ]

  console.log('\n=== 현재 상태 ===')
  for (const name of summaryColls) {
    const count = await earsDb.collection(name).countDocuments()
    console.log(`  ${name}: ${count.toLocaleString()} docs`)
  }
  const cronCount = await webManagerDb.collection('CRON_RUN_LOG').countDocuments()
  console.log(`  CRON_RUN_LOG: ${cronCount.toLocaleString()} docs`)

  if (!opts.keepLogs) {
    const batchLogCount = await webManagerDb.collection('WEBMANAGER_LOG').countDocuments({ category: 'batch' })
    console.log(`  WEBMANAGER_LOG (batch): ${batchLogCount.toLocaleString()} docs`)
  }

  // Confirm
  if (!opts.yes) {
    const ok = await confirm('\n위 데이터를 모두 삭제합니다. 계속할까요? (y/N) ')
    if (!ok) {
      console.log('취소됨.')
      await closeConnections()
      process.exit(0)
    }
  }

  // Delete
  console.log('\n=== 삭제 중 ===')
  for (const name of summaryColls) {
    const res = await earsDb.collection(name).deleteMany({})
    console.log(`  ${name}: ${res.deletedCount.toLocaleString()} deleted`)
  }

  const cronRes = await webManagerDb.collection('CRON_RUN_LOG').deleteMany({})
  console.log(`  CRON_RUN_LOG: ${cronRes.deletedCount.toLocaleString()} deleted`)

  if (!opts.keepLogs) {
    const logRes = await webManagerDb.collection('WEBMANAGER_LOG').deleteMany({ category: 'batch' })
    console.log(`  WEBMANAGER_LOG (batch): ${logRes.deletedCount.toLocaleString()} deleted`)
  }

  console.log('\n초기화 완료.')
  await closeConnections()
  process.exit(0)
}

main().catch(err => {
  console.error('Error:', err.message)
  process.exit(1)
})
