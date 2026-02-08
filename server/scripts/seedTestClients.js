/**
 * Seed Test Clients for Phase 0 Verification
 * Upserts TEST_002, TEST_003, PROXY_TEST_001 into EQP_INFO
 * Safe to re-run (uses upsert on eqpId)
 *
 * Usage: node scripts/seedTestClients.js
 */
require('dotenv').config()
const mongoose = require('mongoose')

const testClients = [
  {
    eqpId: 'TEST_002',
    line: 'TEST',
    lineDesc: 'Test_Line',
    process: 'TEST',
    eqpModel: 'TestModel',
    category: 'TEST',
    ipAddr: '127.0.0.1',
    localpc: 0,
    emailcategory: 'TEST',
    osVer: 'Windows_10',
    onoff: 0,
    webmanagerUse: 1,
    usereleasemsg: 0,
    usetkincancel: 0,
    serviceType: 'ars_agent_win_sc'
  },
  {
    eqpId: 'TEST_003',
    line: 'TEST',
    lineDesc: 'Test_Line',
    process: 'TEST',
    eqpModel: 'TestModel',
    category: 'TEST',
    ipAddr: '127.0.0.1',
    localpc: 0,
    emailcategory: 'TEST',
    osVer: 'Windows_10',
    onoff: 0,
    webmanagerUse: 1,
    usereleasemsg: 0,
    usetkincancel: 0,
    serviceType: 'ars_agent_win_sc'
  },
  {
    eqpId: 'PROXY_TEST_001',
    line: 'TEST',
    lineDesc: 'Test_Line',
    process: 'TEST',
    eqpModel: 'TestModel',
    category: 'TEST',
    ipAddr: '127.0.0.1',
    ipAddrL: '127.0.0.1',
    localpc: 0,
    emailcategory: 'TEST',
    osVer: 'Windows_10',
    onoff: 0,
    webmanagerUse: 1,
    usereleasemsg: 0,
    usetkincancel: 0,
    serviceType: 'ars_agent_win_sc'
  }
]

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI)
    console.log('Connected to MongoDB:', process.env.MONGODB_URI)

    const collection = mongoose.connection.db.collection('EQP_INFO')

    for (const client of testClients) {
      const result = await collection.updateOne(
        { eqpId: client.eqpId },
        { $set: client },
        { upsert: true }
      )
      const action = result.upsertedCount > 0 ? 'INSERTED' : 'UPDATED'
      console.log(`  ${action}: ${client.eqpId}`)
    }

    // Verify
    const count = await collection.countDocuments({ eqpId: { $in: testClients.map(c => c.eqpId) } })
    console.log(`\nVerification: ${count}/${testClients.length} test clients exist`)

    // Also ensure TEST_001 has serviceType set
    const test001 = await collection.findOne({ eqpId: 'TEST_001' })
    if (test001 && !test001.serviceType) {
      await collection.updateOne({ eqpId: 'TEST_001' }, { $set: { serviceType: 'ars_agent_win_sc' } })
      console.log('  UPDATED: TEST_001 (added serviceType)')
    }

    console.log('\nSeed completed successfully!')
    process.exit(0)
  } catch (error) {
    console.error('Seed failed:', error.message)
    process.exit(1)
  }
}

seed()
