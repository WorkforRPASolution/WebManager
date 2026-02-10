/**
 * Seed script for feature permissions
 * Run: node scripts/seedPermissions.js
 * Options:
 *   --reset: Delete existing permissions and recreate
 */

require('dotenv').config()
const { connectDB, closeConnections } = require('../shared/db/connection')
const { FeaturePermission, DEFAULT_FEATURE_PERMISSIONS, FEATURE_NAMES } = require('../features/permissions/model')

async function seedPermissions() {
  try {
    // Connect to MongoDB
    await connectDB()
    console.log('Connected to MongoDB')

    // Check existing permissions
    const existingCount = await FeaturePermission.countDocuments()
    console.log(`Found ${existingCount} existing feature permissions`)

    if (process.argv.includes('--reset')) {
      await FeaturePermission.deleteMany({})
      console.log('Deleted existing feature permissions')
    }

    // Insert default permissions
    let created = 0
    let skipped = 0

    for (const defaultPerm of DEFAULT_FEATURE_PERMISSIONS) {
      const existing = await FeaturePermission.findOne({ feature: defaultPerm.feature })

      if (existing) {
        console.log(`  - Skipping existing: ${FEATURE_NAMES[defaultPerm.feature]} (${defaultPerm.feature})`)
        skipped++
        continue
      }

      await FeaturePermission.create({
        feature: defaultPerm.feature,
        permissions: defaultPerm.permissions,
        updatedBy: 'system'
      })

      console.log(`  + Created: ${FEATURE_NAMES[defaultPerm.feature]} (${defaultPerm.feature})`)
      created++
    }

    console.log(`\nSummary: ${created} created, ${skipped} skipped`)

    // Display current permissions
    console.log('\n--- Feature Permissions ---')
    const allPermissions = await FeaturePermission.find().lean()

    for (const perm of allPermissions) {
      console.log(`\n${FEATURE_NAMES[perm.feature] || perm.feature}:`)

      const permissions = perm.permissions instanceof Map
        ? Object.fromEntries(perm.permissions)
        : perm.permissions

      const roleNames = ['User', 'Admin', 'Conductor', 'Manager']

      for (const [level, perms] of Object.entries(permissions)) {
        const flags = []
        if (perms.read) flags.push('R')
        if (perms.write) flags.push('W')
        if (perms.delete) flags.push('D')

        console.log(`  Level ${level} (${roleNames[level] || 'Unknown'}): ${flags.join('/') || '-'}`)
      }
    }

    console.log('\nFeature permissions seeded successfully!')

    await closeConnections()
    console.log('Disconnected from MongoDB')
  } catch (error) {
    console.error('Error seeding feature permissions:', error)
    process.exit(1)
  }
}

seedPermissions()
