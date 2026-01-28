#!/usr/bin/env node

/**
 * Migration Script: EARS → WEBMANAGER DB
 *
 * Migrates WebManager-specific collections from EARS to WEBMANAGER database:
 * - FEATURE_PERMISSIONS
 * - OS_VERSION_LIST
 * - WEBMANAGER_ROLE_PERMISSIONS
 *
 * Usage:
 *   node server/scripts/migrateToWebManagerDB.js [--delete-source]
 *
 * Options:
 *   --delete-source  Delete source collections from EARS after successful migration
 */

const { MongoClient } = require('mongodb')

const EARS_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/EARS'
const WEBMANAGER_URI = process.env.WEBMANAGER_DB_URI || 'mongodb://localhost:27017/WEB_MANAGER'

const COLLECTIONS_TO_MIGRATE = [
  'FEATURE_PERMISSIONS',
  'OS_VERSION_LIST',
  'WEBMANAGER_ROLE_PERMISSIONS'
]

async function migrate() {
  const deleteSource = process.argv.includes('--delete-source')

  console.log('=' .repeat(60))
  console.log('WebManager DB Migration')
  console.log('=' .repeat(60))
  console.log(`Source: ${EARS_URI}`)
  console.log(`Target: ${WEBMANAGER_URI}`)
  console.log(`Delete source after migration: ${deleteSource}`)
  console.log('=' .repeat(60))

  let earsClient
  let webManagerClient

  try {
    // Connect to both databases
    console.log('\n[1/4] Connecting to databases...')
    earsClient = await MongoClient.connect(EARS_URI)
    webManagerClient = await MongoClient.connect(WEBMANAGER_URI)

    const earsDb = earsClient.db()
    const webManagerDb = webManagerClient.db()

    console.log('  ✓ Connected to EARS')
    console.log('  ✓ Connected to WEBMANAGER')

    // Check which collections exist in source
    console.log('\n[2/4] Checking source collections...')
    const existingCollections = await earsDb.listCollections().toArray()
    const existingNames = existingCollections.map(c => c.name)

    const collectionsToProcess = COLLECTIONS_TO_MIGRATE.filter(name => {
      const exists = existingNames.includes(name)
      console.log(`  ${exists ? '✓' : '✗'} ${name}${exists ? '' : ' (not found, skipping)'}`)
      return exists
    })

    if (collectionsToProcess.length === 0) {
      console.log('\n  No collections to migrate. Exiting.')
      return
    }

    // Migrate each collection
    console.log('\n[3/4] Migrating collections...')
    const results = []

    for (const collectionName of collectionsToProcess) {
      console.log(`\n  Migrating ${collectionName}...`)

      const sourceCollection = earsDb.collection(collectionName)
      const targetCollection = webManagerDb.collection(collectionName)

      // Get documents from source
      const documents = await sourceCollection.find({}).toArray()
      console.log(`    Found ${documents.length} documents`)

      if (documents.length === 0) {
        results.push({ collection: collectionName, migrated: 0, status: 'empty' })
        continue
      }

      // Check if target already has data
      const targetCount = await targetCollection.countDocuments()
      if (targetCount > 0) {
        console.log(`    ⚠ Target already has ${targetCount} documents`)
        console.log(`    Skipping to avoid duplicates. Clear target first if needed.`)
        results.push({ collection: collectionName, migrated: 0, status: 'skipped (target not empty)' })
        continue
      }

      // Insert into target
      const insertResult = await targetCollection.insertMany(documents)
      console.log(`    ✓ Inserted ${insertResult.insertedCount} documents`)

      results.push({
        collection: collectionName,
        migrated: insertResult.insertedCount,
        status: 'success'
      })
    }

    // Delete source collections if requested
    if (deleteSource) {
      console.log('\n[4/4] Cleaning up source collections...')
      for (const { collection, status } of results) {
        if (status === 'success') {
          await earsDb.collection(collection).drop()
          console.log(`  ✓ Dropped ${collection} from EARS`)
        }
      }
    } else {
      console.log('\n[4/4] Skipping source cleanup (use --delete-source to remove)')
    }

    // Summary
    console.log('\n' + '=' .repeat(60))
    console.log('Migration Summary')
    console.log('=' .repeat(60))
    for (const { collection, migrated, status } of results) {
      console.log(`  ${collection}: ${migrated} documents (${status})`)
    }
    console.log('=' .repeat(60))
    console.log('\nMigration completed successfully!')

  } catch (error) {
    console.error('\n✗ Migration failed:', error.message)
    process.exit(1)
  } finally {
    if (earsClient) await earsClient.close()
    if (webManagerClient) await webManagerClient.close()
  }
}

migrate()
