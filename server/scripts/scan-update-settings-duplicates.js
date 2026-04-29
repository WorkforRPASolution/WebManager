/**
 * One-off scan: UPDATE_SETTINGS duplicates by (agentGroup, name, osVer, version).
 *
 * Use case: before strengthening the unique index from (agentGroup, profileId)
 * to (agentGroup, name, osVer, version), find user-visible duplicates that
 * would block index creation.
 *
 * Read-only. No writes.
 *
 *   node server/scripts/scan-update-settings-duplicates.js
 */

require('dotenv').config()
const { connectDB, closeConnections, webManagerConnection } = require('../shared/db/connection')
const { findDuplicateGroups, findNameCollisions } = require('./lib/scanUpdateSettingsDuplicates')

async function main() {
  await connectDB()
  const collection = webManagerConnection.db.collection('UPDATE_SETTINGS')

  const total = await collection.countDocuments({})
  const legacy = await collection.countDocuments({ profiles: { $exists: true } })
  const perProfile = total - legacy

  console.log('\n=== UPDATE_SETTINGS duplicate scan ===')
  console.log(`  Total documents:       ${total}`)
  console.log(`  Legacy (profiles[]):   ${legacy}`)
  console.log(`  Per-profile docs:      ${perProfile}`)

  if (perProfile === 0) {
    console.log('\nNo per-profile documents to scan.')
    await closeConnections()
    return
  }

  const duplicates = await findDuplicateGroups(collection)
  console.log(`\n  Duplicate (agentGroup, name, osVer, version) groups: ${duplicates.length}`)

  if (duplicates.length === 0) {
    console.log('  ✓ No user-visible duplicates — safe to add compound unique index.')
  } else {
    console.log('\n  ⚠ Duplicate groups found:\n')
    for (const dup of duplicates) {
      const { agentGroup, name, osVer, version } = dup._id
      console.log(`    agentGroup=${agentGroup}  name="${name}"  osVer="${osVer}"  version="${version}"  count=${dup.count}`)
      dup.profileIds.forEach((pid, idx) => {
        const ts = dup.updatedAts[idx]?.toISOString?.() || 'n/a'
        console.log(`      [${idx}] profileId=${pid}  updatedAt=${ts}`)
      })
      console.log('')
    }
  }

  const softGroups = await findNameCollisions(collection)
  console.log(`  Same (agentGroup, name) with >1 profile (option A blocker): ${softGroups.length}`)
  if (softGroups.length > 0) {
    for (const g of softGroups.slice(0, 5)) {
      console.log(`    agentGroup=${g._id.agentGroup}  name="${g._id.name}"  variants=${g.count}`)
      g.variants.forEach(v => console.log(`      profileId=${v.profileId}  osVer="${v.osVer}"  version="${v.version}"`))
    }
    if (softGroups.length > 5) console.log(`    ... and ${softGroups.length - 5} more`)
  }

  await closeConnections()
}

main().catch(err => {
  console.error('Scan failed:', err)
  process.exit(1)
})
