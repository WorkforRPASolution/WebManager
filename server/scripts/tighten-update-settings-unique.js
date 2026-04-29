/**
 * One-shot migration: strengthen UPDATE_SETTINGS unique index.
 *
 * BEFORE : { agentGroup: 1, profileId: 1 } unique  — a vacuous constraint
 *          because profileId is a fresh UUID, so it never collides.
 * AFTER  : { agentGroup: 1, name: 1, osVer: 1, version: 1 } unique
 *          — matches the user-visible identifier shown in UpdateModal
 *          (`{name} ({osVer||'All OS'}) v{version}`), preventing two profiles
 *          from rendering as identical dropdown lines.
 *          { agentGroup: 1, profileId: 1 } is recreated as non-unique
 *          for REST lookup and audit documentId resolution.
 *
 * Run per environment (dev → staging → prod), AFTER migrate-update-settings:
 *   npm run migrate:update-settings-unique -- --dry-run   # preview
 *   npm run migrate:update-settings-unique -- --yes       # apply
 *
 * Idempotent: once the new unique index exists the script is a no-op.
 * Safe: aborts without writing if any user-visible duplicates exist.
 * Operator cleans the duplicates manually, then re-runs.
 *
 * TODO: remove this script after all environments are migrated.
 */

const { findDuplicateGroups } = require('./lib/scanUpdateSettingsDuplicates')

const NEW_UNIQUE_NAME = 'agentGroup_name_osVer_version_unique'
const LOOKUP_INDEX_NAME = 'agentGroup_1_profileId_1'

/**
 * @returns {Promise<{
 *   duplicateGroups: number, duplicates: Array,
 *   alreadyTightened: boolean,
 *   indexDropped: boolean, indexCreated: boolean,
 *   aborted: boolean, errors: Array
 * }>}
 */
async function tightenCollection(collection, options = {}) {
  const { dryRun = false } = options
  const stats = {
    duplicateGroups: 0,
    duplicates: [],
    alreadyTightened: false,
    indexDropped: false,
    indexCreated: false,
    aborted: false,
    errors: []
  }

  // Short-circuit: the tightening is complete only when BOTH conditions hold:
  //  (a) new compound unique on (agentGroup, name, osVer, version) exists
  //  (b) legacy (agentGroup, profileId) index is non-unique (lookup-only)
  // Mongoose's createIndexes() does not drop an existing unique with the same
  // shape, so (a) may hold while (b) doesn't — in that case we still need to
  // swap the legacy index's unique flag.
  const existing = await collection.indexes()
  const hasNewUnique = existing.some(i => i.name === NEW_UNIQUE_NAME && i.unique)
  const legacyLookup = existing.find(i => i.name === LOOKUP_INDEX_NAME)
  const legacyLookupIsNonUnique = legacyLookup && !legacyLookup.unique
  if (hasNewUnique && legacyLookupIsNonUnique) {
    stats.alreadyTightened = true
    return stats
  }

  // Scan for user-visible duplicates that would block the new unique index.
  const dups = await findDuplicateGroups(collection)
  stats.duplicateGroups = dups.length
  stats.duplicates = dups

  if (dups.length > 0) {
    if (!dryRun) stats.aborted = true
    return stats
  }

  if (dryRun) return stats

  // Drop the legacy unique index (by both possible names — the compound and
  // the pre-per-profile single-field legacy). Tolerate NotFound.
  for (const name of [LOOKUP_INDEX_NAME, 'agentGroup_1']) {
    try {
      await collection.dropIndex(name)
      stats.indexDropped = true
    } catch (err) {
      if (err.codeName !== 'IndexNotFound' && err.code !== 27) {
        stats.errors.push({ op: `dropIndex ${name}`, message: err.message })
      }
    }
  }

  // Create new compound unique if missing.
  if (!hasNewUnique) {
    try {
      await collection.createIndex(
        { agentGroup: 1, name: 1, osVer: 1, version: 1 },
        { unique: true, name: NEW_UNIQUE_NAME }
      )
      stats.indexCreated = true
    } catch (err) {
      stats.errors.push({ op: 'createIndex unique', message: err.message })
    }
  }

  // Recreate lookup index as non-unique.
  try {
    await collection.createIndex(
      { agentGroup: 1, profileId: 1 },
      { name: LOOKUP_INDEX_NAME }
    )
  } catch (err) {
    if (err.codeName !== 'IndexOptionsConflict') {
      stats.errors.push({ op: 'createIndex lookup', message: err.message })
    }
  }

  return stats
}

// ─── CLI ──────────────────────────────────────────────────────────

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

  console.log('\n=== UPDATE_SETTINGS unique index tightening ===')
  console.log(`  Mode: ${opts.dryRun ? 'DRY RUN (no writes)' : 'APPLY'}`)

  // Preview scan
  const preStats = await tightenCollection(collection, { dryRun: true })

  if (preStats.alreadyTightened) {
    console.log('\n  ✓ New unique index already present — nothing to do.')
    await closeConnections()
    return
  }

  console.log(`\n  Duplicate (agentGroup, name, osVer, version) groups: ${preStats.duplicateGroups}`)
  if (preStats.duplicateGroups > 0) {
    console.log('\n  ⚠ Duplicates block the new unique index:\n')
    for (const dup of preStats.duplicates) {
      const { agentGroup, name, osVer, version } = dup._id
      console.log(`    agentGroup=${agentGroup}  name="${name}"  osVer="${osVer}"  version="${version}"  count=${dup.count}`)
      dup.profileIds.forEach((pid, idx) => {
        const ts = dup.updatedAts[idx]?.toISOString?.() || 'n/a'
        console.log(`      [${idx}] profileId=${pid}  updatedAt=${ts}`)
      })
    }
    console.log('\n  Resolve duplicates manually (keep the correct profileId, delete others),')
    console.log('  then re-run this script.')
    process.exitCode = 1
    await closeConnections()
    return
  }

  if (opts.dryRun) {
    console.log('\n  ✓ No duplicates. Apply mode would swap the index. Re-run with --yes to apply.')
    await closeConnections()
    return
  }

  if (!opts.yes) {
    const ok = await confirm('\nProceed to drop legacy unique and create new compound unique? [y/N] ')
    if (!ok) {
      console.log('Aborted.')
      await closeConnections()
      return
    }
  }

  const stats = await tightenCollection(collection, { dryRun: false })

  console.log('\n=== Result ===')
  console.log(`  Legacy index dropped:      ${stats.indexDropped}`)
  console.log(`  New unique index created:  ${stats.indexCreated}`)
  if (stats.errors.length > 0) {
    console.log(`  Errors:                    ${stats.errors.length}`)
    for (const err of stats.errors) console.log(`    - ${JSON.stringify(err)}`)
    process.exitCode = 1
  } else {
    console.log('  ✓ Unique index swap complete.')
  }

  await closeConnections()
}

if (require.main === module) {
  main().catch(err => {
    console.error('Tighten migration failed:', err)
    process.exit(1)
  })
}

module.exports = { tightenCollection, parseArgs, NEW_UNIQUE_NAME, LOOKUP_INDEX_NAME }
