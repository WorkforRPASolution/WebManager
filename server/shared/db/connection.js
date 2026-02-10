/**
 * MongoDB Connection Manager
 * Supports dual database connections:
 * - EARS: Shared data with Akka server (EQP_INFO, EMAIL_TEMPLATE_REPOSITORY, etc.)
 * - WEBMANAGER: WebManager-specific data (FEATURE_PERMISSIONS, OS_VERSION_LIST, etc.)
 */

const mongoose = require('mongoose');

// Create separate connections for each database
const earsConnection = mongoose.createConnection();
const webManagerConnection = mongoose.createConnection();

/**
 * Connect to both databases
 */
const connectDB = async () => {
  try {
    const earsUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/EARS';
    const webManagerUri = process.env.WEBMANAGER_DB_URI || 'mongodb://localhost:27017/WEB_MANAGER';

    // Connect to EARS database (shared with Akka)
    await earsConnection.openUri(earsUri, { autoIndex: false });
    console.log(`MongoDB EARS Connected: ${earsConnection.host}`);

    // Connect to WEBMANAGER database (WebManager-specific)
    await webManagerConnection.openUri(webManagerUri);
    console.log(`MongoDB WEBMANAGER Connected: ${webManagerConnection.host}`);

    // Error handlers for EARS connection
    earsConnection.on('error', (err) => {
      console.error('MongoDB EARS connection error:', err);
    });

    earsConnection.on('disconnected', () => {
      console.log('MongoDB EARS disconnected');
    });

    // Error handlers for WEBMANAGER connection
    webManagerConnection.on('error', (err) => {
      console.error('MongoDB WEBMANAGER connection error:', err);
    });

    webManagerConnection.on('disconnected', () => {
      console.log('MongoDB WEBMANAGER disconnected');
    });

  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    process.exit(1);
  }
};

/**
 * Close all database connections
 */
const closeConnections = async () => {
  await earsConnection.close();
  await webManagerConnection.close();
  console.log('All MongoDB connections closed');
};

module.exports = {
  connectDB,
  closeConnections,
  earsConnection,
  webManagerConnection
};
