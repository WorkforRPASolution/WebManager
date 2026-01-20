require('dotenv').config();
const mongoose = require('mongoose');
const Client = require('../features/clients/model');

const processes = ['ETCH', 'CVD', 'DIFF', 'PHOTO', 'IMP'];
const categories = ['Process', 'Metrology', 'Transfer'];
const osVersions = ['Windows 10', 'Windows 11', 'Windows Server 2019', 'Windows Server 2022'];

const generateSampleData = () => {
  const clients = [];

  processes.forEach((process, pIdx) => {
    const modelCount = Math.floor(Math.random() * 3) + 2; // 2-4 models per process

    for (let mIdx = 0; mIdx < modelCount; mIdx++) {
      const eqpModel = `${process}-MODEL-${String.fromCharCode(65 + mIdx)}`;
      const clientCount = Math.floor(Math.random() * 5) + 3; // 3-7 clients per model

      for (let cIdx = 0; cIdx < clientCount; cIdx++) {
        const eqpId = `${process}-${String.fromCharCode(65 + mIdx)}${String(cIdx + 1).padStart(2, '0')}`;

        clients.push({
          line: `LINE-${pIdx + 1}`,
          lineDesc: `Production Line ${pIdx + 1}`,
          process: process,
          eqpModel: eqpModel,
          eqpId: eqpId,
          category: categories[Math.floor(Math.random() * categories.length)],
          ipAddr: `192.168.${10 + pIdx}.${100 + mIdx * 10 + cIdx}`,
          ipAddrL: `10.0.${pIdx}.${mIdx * 10 + cIdx}`,
          localpc: Math.random() > 0.8 ? 1 : 0,
          emailcategory: 'DEFAULT',
          osVer: osVersions[Math.floor(Math.random() * osVersions.length)],
          onoff: Math.random() > 0.15 ? 1 : 0, // 85% online
          webmanagerUse: 1,
          installdate: `2024-${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}`,
          scFirstExcute: `2024-${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}`,
          snapshotTimeDiff: Math.floor(Math.random() * 100),
          usereleasemsg: 1,
          usetkincancel: 0,
        });
      }
    }
  });

  return clients;
};

const seedDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing data
    const deleteResult = await Client.deleteMany({});
    console.log(`Deleted ${deleteResult.deletedCount} existing documents`);

    // Generate and insert sample data
    const sampleData = generateSampleData();
    const insertResult = await Client.insertMany(sampleData);
    console.log(`Inserted ${insertResult.length} sample documents`);

    // Show summary
    const processes = await Client.distinct('process');
    console.log('\n=== Data Summary ===');
    console.log(`Total clients: ${insertResult.length}`);
    console.log(`Processes: ${processes.join(', ')}`);

    for (const process of processes) {
      const models = await Client.distinct('eqpModel', { process });
      const count = await Client.countDocuments({ process });
      console.log(`  ${process}: ${count} clients (${models.length} models)`);
    }

    const onlineCount = await Client.countDocuments({ onoff: 1 });
    console.log(`\nOnline clients: ${onlineCount}/${insertResult.length}`);

    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
};

seedDatabase();
