/**
 * Migration Script: Populate processes array from process string
 *
 * This script migrates existing USER_INFO documents to add the `processes` array field
 * based on the existing `process` string field (semicolon-separated values).
 *
 * Usage:
 *   node server/scripts/migrateProcesses.js
 *
 * What it does:
 *   1. Finds all users where `processes` field doesn't exist or is empty
 *   2. Parses the `process` string field (split by `;`)
 *   3. Updates each user with the `processes` array
 *
 * This is a safe operation:
 *   - Does not modify the original `process` field
 *   - Only updates documents that need migration
 *   - Runs in a single transaction where possible
 */

require('dotenv').config()
const mongoose = require('mongoose')

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/EARS'

// User schema (minimal for migration)
const userSchema = new mongoose.Schema({
  process: String,
  processes: [String]
}, { collection: 'ARS_USER_INFO', strict: false })

const User = mongoose.model('MigrationUser', userSchema)

async function migrate() {
  console.log('=== Processes Field Migration ===')
  console.log(`Connecting to MongoDB: ${MONGODB_URI}`)

  try {
    await mongoose.connect(MONGODB_URI)
    console.log('Connected to MongoDB')

    // Find users that need migration
    const usersToMigrate = await User.find({
      $or: [
        { processes: { $exists: false } },
        { processes: { $size: 0 } }
      ]
    }).lean()

    console.log(`Found ${usersToMigrate.length} users to migrate`)

    if (usersToMigrate.length === 0) {
      console.log('No migration needed. All users already have processes array.')
      return
    }

    let migrated = 0
    let skipped = 0
    let errors = 0

    for (const user of usersToMigrate) {
      try {
        // Parse process string into array
        const processString = user.process || ''
        const processesArray = processString
          .split(';')
          .map(p => p.trim())
          .filter(Boolean)

        if (processesArray.length === 0) {
          console.log(`  Skipping user ${user._id}: empty process field`)
          skipped++
          continue
        }

        // Update user with processes array
        await User.updateOne(
          { _id: user._id },
          { $set: { processes: processesArray } }
        )

        migrated++
        console.log(`  Migrated user ${user._id}: "${processString}" -> [${processesArray.join(', ')}]`)
      } catch (err) {
        errors++
        console.error(`  Error migrating user ${user._id}:`, err.message)
      }
    }

    console.log('\n=== Migration Summary ===')
    console.log(`Total users found: ${usersToMigrate.length}`)
    console.log(`Migrated: ${migrated}`)
    console.log(`Skipped (empty process): ${skipped}`)
    console.log(`Errors: ${errors}`)

  } catch (err) {
    console.error('Migration failed:', err)
    process.exit(1)
  } finally {
    await mongoose.disconnect()
    console.log('\nDisconnected from MongoDB')
  }
}

// Run migration
migrate()
