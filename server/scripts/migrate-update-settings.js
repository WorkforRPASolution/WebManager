/**
 * One-shot migration: UPDATE_SETTINGS legacy shape → per-profile shape.
 *
 * LEGACY  : { agentGroup, profiles: [{ profileId, ... }] }   — 1 doc per agentGroup
 * NEW     : { agentGroup, profileId, name, tasks, ... }      — 1 doc per (agentGroup, profileId)
 *
 * Run per environment (dev → staging → prod):
 *   npm run migrate:update-settings -- --dry-run   # preview
 *   npm run migrate:update-settings -- --yes       # apply
 *
 * Idempotent: re-running after success finds no legacy docs and exits.
 * Safe: legacy docs are deleted only after per-profile docs are verified present.
 *
 * TODO: remove this script after all environments are migrated.
 */

const { cleanProfile } = require('../features/clients/updateSettingsService')

/**
 * Expand one legacy document into N new per-profile documents.
 * Returns: Array of normalized { agentGroup, profileId, ... } records.
 */
function flattenLegacyDoc(legacyDoc) {
  const agentGroup = legacyDoc.agentGroup
  const profiles = Array.isArray(legacyDoc.profiles) ? legacyDoc.profiles : []
  return profiles.map(p => ({
    agentGroup,
    ...cleanProfile(p),
    updatedBy: legacyDoc.updatedBy || 'migration'
  }))
}

/**
 * Perform the migration against a raw MongoDB collection handle.
 *
 * @param {object} collection - MongoDB collection (native driver handle)
 * @param {object} options - { dryRun }
 * @returns {Promise<{ legacyDocs, expandedProfiles, insertedOrSkipped, legacyDeleted, errors }>}
 */
async function migrateCollection(collection, options = {}) {
  const { dryRun = false } = options
  const stats = {
    legacyDocs: 0,
    expandedProfiles: 0,
    insertedOrSkipped: 0,
    legacyDeleted: 0,
    errors: []
  }

  const legacyDocs = await collection.find({ profiles: { $exists: true } }).toArray()
  stats.legacyDocs = legacyDocs.length
  if (legacyDocs.length === 0) return stats

  // Drop the legacy single-field unique index on agentGroup — incompatible
  // with the new (agentGroup, profileId) compound unique. Idempotent: ignored
  // if already dropped.
  if (!dryRun && typeof collection.dropIndex === 'function') {
    try {
      await collection.dropIndex('agentGroup_1')
    } catch (err) {
      if (!/index not found|ns not found|not found/i.test(err.message || '')) {
        stats.errors.push({ message: `dropIndex agentGroup_1 failed: ${err.message}` })
      }
    }
  }

  for (const legacy of legacyDocs) {
    const newDocs = flattenLegacyDoc(legacy)
    stats.expandedProfiles += newDocs.length

    if (dryRun) continue

    // Upsert each new profile doc; idempotent via (agentGroup, profileId) key.
    for (const doc of newDocs) {
      try {
        await collection.updateOne(
          { agentGroup: doc.agentGroup, profileId: doc.profileId },
          { $set: doc, $setOnInsert: { createdAt: legacy.createdAt || new Date() } },
          { upsert: true }
        )
        stats.insertedOrSkipped++
      } catch (err) {
        stats.errors.push({
          agentGroup: doc.agentGroup,
          profileId: doc.profileId,
          message: err.message
        })
      }
    }

    // Verify all new docs are present before removing the legacy doc.
    const presentCount = await collection.countDocuments({
      agentGroup: legacy.agentGroup,
      profileId: { $in: newDocs.map(d => d.profileId) }
    })
    if (presentCount === newDocs.length) {
      await collection.deleteOne({ _id: legacy._id })
      stats.legacyDeleted++
    } else {
      stats.errors.push({
        agentGroup: legacy.agentGroup,
        message: `verification failed: expected ${newDocs.length} new docs, found ${presentCount}`
      })
    }
  }

  return stats
}

// ============================================
// CLI entrypoint
// ============================================

function parseArgs(argv) {
  const args = argv.slice(2)
  return {
    dryRun: args.includes('--dry-run'),
    yes: args.includes('--yes')
  }
}

async function confirm(question) {
  const readline = require('readline')
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close()
      resolve(/^y(es)?$/i.test(answer.trim()))
    })
  })
}

async function main() {
  require('dotenv').config()
  const opts = parseArgs(process.argv)
  const { connectDB, closeConnections, webManagerConnection } = require('../shared/db/connection')

  await connectDB()
  const collection = webManagerConnection.db.collection('UPDATE_SETTINGS')

  console.log('\n=== UPDATE_SETTINGS migration ===')
  console.log(`  Mode: ${opts.dryRun ? 'DRY RUN (no writes)' : 'APPLY'}`)

  const legacyCount = await collection.countDocuments({ profiles: { $exists: true } })
  const currentCount = await collection.countDocuments({ profiles: { $exists: false } })
  console.log(`  Legacy documents:   ${legacyCount}`)
  console.log(`  Already migrated:   ${currentCount}`)

  if (legacyCount === 0) {
    console.log('\nNothing to do — no legacy documents found.')
    await closeConnections()
    return
  }

  if (!opts.dryRun && !opts.yes) {
    const ok = await confirm(`\nProceed with migration of ${legacyCount} legacy documents? [y/N] `)
    if (!ok) {
      console.log('Aborted.')
      await closeConnections()
      return
    }
  }

  const stats = await migrateCollection(collection, { dryRun: opts.dryRun })

  console.log('\n=== Result ===')
  console.log(`  Legacy docs processed:     ${stats.legacyDocs}`)
  console.log(`  Profiles expanded:         ${stats.expandedProfiles}`)
  console.log(`  New docs upserted:         ${stats.insertedOrSkipped}`)
  console.log(`  Legacy docs deleted:       ${stats.legacyDeleted}`)
  if (stats.errors.length > 0) {
    console.log(`  Errors:                    ${stats.errors.length}`)
    for (const err of stats.errors) {
      console.log(`    - ${JSON.stringify(err)}`)
    }
    process.exitCode = 1
  } else if (!opts.dryRun) {
    // Final verification
    const remaining = await collection.countDocuments({ profiles: { $exists: true } })
    if (remaining === 0) {
      console.log('  ✓ Verification passed — no legacy documents remain.')
    } else {
      console.log(`  ⚠ ${remaining} legacy documents still present. Re-run to retry.`)
      process.exitCode = 1
    }
  }

  await closeConnections()
}

if (require.main === module) {
  main().catch(err => {
    console.error('Migration failed:', err)
    process.exit(1)
  })
}

module.exports = { flattenLegacyDoc, migrateCollection, parseArgs }
