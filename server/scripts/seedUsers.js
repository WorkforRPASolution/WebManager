/**
 * Seed script for test users
 * Run: node scripts/seedUsers.js
 */

require('dotenv').config()
const mongoose = require('mongoose')
const bcrypt = require('bcrypt')
const { User } = require('../features/users/model')

const SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 12

const testUsers = [
  {
    name: 'System Admin',
    singleid: 'admin',
    password: 'admin',
    line: 'HQ',
    process: 'Management',
    authority: 'WRITE',
    authorityManager: 1,
    note: 'System administrator account',
    email: 'admin@webmanager.com',
    department: 'IT',
    isActive: true
  },
  {
    name: 'Conductor User',
    singleid: 'conductor',
    password: 'conductor',
    line: 'HQ',
    process: 'Management',
    authority: 'WRITE',
    authorityManager: 2,
    note: 'Conductor account - highest user authority',
    email: 'conductor@webmanager.com',
    department: 'Management',
    isActive: true
  },
  {
    name: 'Manager User',
    singleid: 'manager',
    password: 'manager',
    line: 'A-Line',
    process: 'Assembly',
    authority: 'WRITE',
    authorityManager: 3,
    note: 'Manager account',
    email: 'manager@webmanager.com',
    department: 'Production',
    isActive: true
  },
  {
    name: 'Regular User',
    singleid: 'user',
    password: 'user',
    line: 'B-Line',
    process: 'Packaging',
    authority: '',
    authorityManager: 0,
    note: 'Regular user account',
    email: 'user@webmanager.com',
    department: 'Operations',
    isActive: true
  }
]

async function seedUsers() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI)
    console.log('Connected to MongoDB')

    // Check existing users
    const existingCount = await User.countDocuments()
    console.log(`Found ${existingCount} existing users`)

    if (process.argv.includes('--reset')) {
      await User.deleteMany({})
      console.log('Deleted existing users')
    }

    // Hash passwords and insert users
    const usersToCreate = await Promise.all(
      testUsers.map(async (user) => {
        // Check if user already exists
        const existing = await User.findOne({ singleid: user.singleid })
        if (existing) {
          console.log(`  - Skipping existing user: ${user.singleid}`)
          return null
        }

        return {
          ...user,
          password: await bcrypt.hash(user.password, SALT_ROUNDS)
        }
      })
    )

    const validUsers = usersToCreate.filter(u => u !== null)

    if (validUsers.length > 0) {
      const result = await User.insertMany(validUsers)
      console.log(`\nCreated ${result.length} users:`)

      for (const user of result) {
        console.log(`  - ${user.singleid} (Level ${user.authorityManager}): ${user.name}`)
      }
    } else {
      console.log('\nNo new users to create')
    }

    console.log('\n--- Test Credentials ---')
    for (const user of testUsers) {
      console.log(`  ${user.singleid} / ${user.password} (Level ${user.authorityManager}: ${['User', 'Admin', 'Conductor', 'Manager'][user.authorityManager]})`)
    }

    console.log('\nUsers seeded successfully!')

    await mongoose.disconnect()
    console.log('Disconnected from MongoDB')
  } catch (error) {
    console.error('Error seeding users:', error)
    process.exit(1)
  }
}

seedUsers()
