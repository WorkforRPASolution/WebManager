/**
 * Migration script: Rename 'master' feature to 'equipmentInfo'
 * Run: node scripts/migrateMasterToEquipmentInfo.js
 */

require('dotenv').config()
const mongoose = require('mongoose')

async function migrate() {
  try {
    await mongoose.connect(process.env.MONGODB_URI)
    console.log('Connected to MongoDB')

    const db = mongoose.connection.db
    const collection = db.collection('FEATURE_PERMISSIONS')

    // Check if 'master' exists
    const masterDoc = await collection.findOne({ feature: 'master' })

    if (!masterDoc) {
      console.log('No "master" feature found. Nothing to migrate.')

      // Check if equipmentInfo already exists
      const eqDoc = await collection.findOne({ feature: 'equipmentInfo' })
      if (eqDoc) {
        console.log('"equipmentInfo" already exists.')
      } else {
        console.log('"equipmentInfo" does not exist. Run seedPermissions.js to create it.')
      }

      await mongoose.disconnect()
      return
    }

    console.log('Found "master" feature permission:')
    console.log(JSON.stringify(masterDoc, null, 2))

    // Check if 'equipmentInfo' already exists
    const equipmentInfoDoc = await collection.findOne({ feature: 'equipmentInfo' })
    if (equipmentInfoDoc) {
      console.log('\n"equipmentInfo" already exists. Deleting old "master" entry...')
      await collection.deleteOne({ feature: 'master' })
      console.log('Deleted "master" entry.')
    } else {
      // Rename 'master' to 'equipmentInfo'
      console.log('\nRenaming "master" to "equipmentInfo"...')
      await collection.updateOne(
        { feature: 'master' },
        { $set: { feature: 'equipmentInfo' } }
      )
      console.log('Successfully renamed "master" to "equipmentInfo"!')
    }

    // Verify
    const result = await collection.find({}).toArray()
    console.log('\n--- Current Feature Permissions ---')
    for (const doc of result) {
      console.log(`  - ${doc.feature}`)
    }

    console.log('\nMigration completed!')
    await mongoose.disconnect()
    console.log('Disconnected from MongoDB')
  } catch (error) {
    console.error('Migration error:', error)
    process.exit(1)
  }
}

migrate()
