require('dotenv').config();
const app = require('./app');
const { connectDB } = require('./shared/db/connection');
const { initializeDefaultPermissions } = require('./features/permissions/service');
const { initializeRolePermissions } = require('./features/users/service');
const { initializeOSVersions } = require('./features/os-version/service');

const PORT = process.env.PORT || 3000;

// Connect to MongoDB and start server
const startServer = async () => {
  try {
    await connectDB();

    // Sync permissions and initialize data
    console.log('Syncing permissions...');
    await initializeDefaultPermissions();
    await initializeRolePermissions();
    await initializeOSVersions();
    console.log('Permissions synced');

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
