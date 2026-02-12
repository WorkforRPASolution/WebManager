/**
 * Migration script: Rename feature permission key from 'arsAgent' to 'clientControl'
 *
 * Usage:
 *   node scripts/migrateFeaturePermissionKey.js
 *
 * This script renames the FEATURE_PERMISSIONS document where feature='arsAgent'
 * to feature='clientControl'. If the document doesn't exist or has already been
 * migrated, the script handles it gracefully.
 */

require('dotenv').config()
const { connectDB, closeConnections, webManagerConnection } = require('../shared/db/connection')

async function migrateFeaturePermissionKey() {
  try {
    // Connect to MongoDB
    await connectDB()
    console.log('Connected to MongoDB WEB_MANAGER')

    // Get the collection
    const collection = webManagerConnection.collection('FEATURE_PERMISSIONS')

    // Check if document with 'arsAgent' exists
    const existingArsAgent = await collection.findOne({ feature: 'arsAgent' })

    if (!existingArsAgent) {
      console.log('✓ No document with feature="arsAgent" found (already migrated or never existed)')
      await closeConnections()
      return
    }

    console.log(`Found document to migrate:`)
    console.log(`  ID: ${existingArsAgent._id}`)
    console.log(`  feature: ${existingArsAgent.feature}`)

    // Rename the feature key from 'arsAgent' to 'clientControl'
    const result = await collection.updateOne(
      { feature: 'arsAgent' },
      { $set: { feature: 'clientControl' } }
    )

    if (result.modifiedCount > 0) {
      console.log(`✓ Successfully migrated 1 document`)
      console.log(`  feature: arsAgent → clientControl`)
    } else if (result.matchedCount > 0) {
      console.log('✗ Document matched but was not modified (may already be "clientControl")')
    } else {
      console.log('✗ No matching document found')
    }

    // Verify the migration
    const migratedDoc = await collection.findOne({ feature: 'clientControl' })
    if (migratedDoc) {
      console.log(`\nVerification successful:`)
      console.log(`  ID: ${migratedDoc._id}`)
      console.log(`  feature: ${migratedDoc.feature}`)
    }

    // Check if old document still exists
    const oldDoc = await collection.findOne({ feature: 'arsAgent' })
    if (!oldDoc) {
      console.log(`✓ Old document with feature="arsAgent" successfully removed`)
    }

    await closeConnections()
    console.log('\nMigration completed successfully!')
    process.exit(0)

  } catch (error) {
    console.error('Error during migration:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

migrateFeaturePermissionKey()
