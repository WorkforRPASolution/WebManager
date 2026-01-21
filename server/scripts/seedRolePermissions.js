/**
 * Seed script for role permissions
 * Run: node scripts/seedRolePermissions.js
 */

require('dotenv').config()
const mongoose = require('mongoose')
const { RolePermission, DEFAULT_ROLE_PERMISSIONS } = require('../features/users/model')

async function seedRolePermissions() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI)
    console.log('Connected to MongoDB')

    // Check existing roles
    const existingCount = await RolePermission.countDocuments()
    if (existingCount > 0) {
      console.log(`Found ${existingCount} existing role permissions`)
      console.log('Do you want to reset them? (Run with --reset flag)')

      if (process.argv.includes('--reset')) {
        await RolePermission.deleteMany({})
        console.log('Deleted existing role permissions')
      } else {
        console.log('Skipping seed (use --reset to overwrite)')
        await mongoose.disconnect()
        return
      }
    }

    // Insert default role permissions
    const result = await RolePermission.insertMany(DEFAULT_ROLE_PERMISSIONS)
    console.log(`Created ${result.length} role permissions:`)

    for (const role of result) {
      console.log(`  - Level ${role.roleLevel}: ${role.roleName}`)
    }

    console.log('\nRole permissions seeded successfully!')

    await mongoose.disconnect()
    console.log('Disconnected from MongoDB')
  } catch (error) {
    console.error('Error seeding role permissions:', error)
    process.exit(1)
  }
}

seedRolePermissions()
