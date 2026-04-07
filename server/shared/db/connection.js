/**
 * MongoDB Connection Manager
 * Supports dual database connections:
 * - EARS: Shared data with Akka server (EQP_INFO, EMAIL_TEMPLATE_REPOSITORY, etc.)
 * - WEBMANAGER: WebManager-specific data (FEATURE_PERMISSIONS, OS_VERSION_LIST, etc.)
 */

const mongoose = require('mongoose');
const { createLogger } = require('../logger');
const log = createLogger('db');

// Connection pool sizing — Pod별 풀, 멀티 Pod 환경에서 전체 부하 예측 가능하게 함
// 산출 근거: 운영 측정 nodejs 연결 ~20개 (EARS+WM 합산), 2~3배 헤드룸 적용
function parsePoolSize(envName, defaultValue) {
  const raw = process.env[envName];
  if (raw === undefined || raw === null || raw === '') return defaultValue;
  const parsed = parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    log.warn(`Invalid ${envName}=${JSON.stringify(raw)}, using default ${defaultValue}`);
    return defaultValue;
  }
  return parsed;
}

let EARS_MAX_POOL = parsePoolSize('EARS_MAX_POOL_SIZE', 30);
let EARS_MIN_POOL = parsePoolSize('EARS_MIN_POOL_SIZE', 5);
let WM_MAX_POOL = parsePoolSize('WEBMANAGER_MAX_POOL_SIZE', 15);
let WM_MIN_POOL = parsePoolSize('WEBMANAGER_MIN_POOL_SIZE', 2);

// min > max 클램핑 (잘못된 환경변수 조합 방어)
if (EARS_MIN_POOL > EARS_MAX_POOL) {
  log.warn(`EARS_MIN_POOL_SIZE(${EARS_MIN_POOL}) > MAX(${EARS_MAX_POOL}), clamping min to max`);
  EARS_MIN_POOL = EARS_MAX_POOL;
}
if (WM_MIN_POOL > WM_MAX_POOL) {
  log.warn(`WEBMANAGER_MIN_POOL_SIZE(${WM_MIN_POOL}) > MAX(${WM_MAX_POOL}), clamping min to max`);
  WM_MIN_POOL = WM_MAX_POOL;
}

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
    await earsConnection.openUri(earsUri, {
      autoIndex: false,
      appName: 'WebManager',
      maxPoolSize: EARS_MAX_POOL,
      minPoolSize: EARS_MIN_POOL
    });
    log.info(`MongoDB EARS Connected: ${earsConnection.host} (pool: ${EARS_MIN_POOL}-${EARS_MAX_POOL})`);

    // Connect to WEBMANAGER database (WebManager-specific)
    await webManagerConnection.openUri(webManagerUri, {
      appName: 'WebManager',
      maxPoolSize: WM_MAX_POOL,
      minPoolSize: WM_MIN_POOL
    });
    log.info(`MongoDB WEBMANAGER Connected: ${webManagerConnection.host} (pool: ${WM_MIN_POOL}-${WM_MAX_POOL})`);

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
