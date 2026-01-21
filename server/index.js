require('dotenv').config();
const app = require('./app');
const connectDB = require('./shared/db/connection');
const { initializeDefaultPermissions } = require('./features/permissions/service');

const PORT = process.env.PORT || 3000;

// Connect to MongoDB and start server
const startServer = async () => {
  try {
    await connectDB();

    // Initialize default feature permissions if not exist
    await initializeDefaultPermissions();
    console.log('Feature permissions initialized');

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
