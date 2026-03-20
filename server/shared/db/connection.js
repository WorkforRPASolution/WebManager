/**
 * MongoDB Connection Manager
 * Supports dual database connections:
 * - EARS: Shared data with Akka server (EQP_INFO, EMAIL_TEMPLATE_REPOSITORY, etc.)
 * - WEBMANAGER: WebManager-specific data (FEATURE_PERMISSIONS, OS_VERSION_LIST, etc.)
 */

const mongoose = require('mongoose');
const { createLogger } = require('../logger');
const log = createLogger('db');

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
    log.info(`MongoDB EARS Connected: ${earsConnection.host}`);

    // Connect to WEBMANAGER database (WebManager-specific)
    await webManagerConnection.openUri(webManagerUri);
    log.info(`MongoDB WEBMANAGER Connected: ${webManagerConnection.host}`);

    // Error handlers for EARS connection
    earsConnection.on('error', (err) => {
      log.error(`MongoDB EARS connection error: ${err.message}`);
    });

    earsConnection.on('disconnected', () => {
      log.warn('MongoDB EARS disconnected');
    });

    // Error handlers for WEBMANAGER connection
    webManagerConnection.on('error', (err) => {
      log.error(`MongoDB WEBMANAGER connection error: ${err.message}`);
    });

    webManagerConnection.on('disconnected', () => {
      log.warn('MongoDB WEBMANAGER disconnected');
    });

  } catch (error) {
    log.error(`MongoDB connection failed: ${error.message}`);
    process.exit(1);
  }
};

/**
 * Close all database connections
 */
const closeConnections = async () => {
  await earsConnection.close();
  await webManagerConnection.close();
  log.info('All MongoDB connections closed');
};

module.exports = {
  connectDB,
  closeConnections,
  earsConnection,
  webManagerConnection
};
