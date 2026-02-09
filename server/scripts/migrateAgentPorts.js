/**
 * Migration: socksPort -> agentPorts.socks
 *
 * Migrates existing EQP_INFO documents:
 * 1. Documents with a socksPort value: set agentPorts.socks = socksPort
 * 2. All documents: remove the socksPort field
 *
 * Usage: node server/scripts/migrateAgentPorts.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const mongoose = require('mongoose');

async function migrate() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/EARS';
  console.log(`Connecting to MongoDB: ${uri}`);

  const conn = await mongoose.createConnection(uri).asPromise();
  const collection = conn.collection('EQP_INFO');

  // Step 1: Migrate documents that have a truthy socksPort value
  const migrateResult = await collection.updateMany(
    { socksPort: { $exists: true, $nin: [null, 0] } },
    [
      {
        $set: {
          'agentPorts.socks': '$socksPort'
        }
      }
    ]
  );
  console.log(`Migrated: ${migrateResult.modifiedCount} documents (socksPort -> agentPorts.socks)`);

  // Step 2: Remove socksPort field from ALL documents
  const cleanResult = await collection.updateMany(
    {},
    { $unset: { socksPort: '' } }
  );
  console.log(`Cleaned: ${cleanResult.modifiedCount} documents (socksPort field removed)`);

  // Summary
  const total = await collection.countDocuments();
  const withAgentPorts = await collection.countDocuments({ 'agentPorts.socks': { $exists: true } });
  console.log(`\nSummary:`);
  console.log(`  Total documents: ${total}`);
  console.log(`  Documents with agentPorts.socks: ${withAgentPorts}`);

  await conn.close();
  console.log('Done. Connection closed.');
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
