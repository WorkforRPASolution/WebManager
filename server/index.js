require('dotenv').config();
const { logger, createLogger } = require('./shared/logger');
const app = require('./app');
const { connectDB, closeConnections } = require('./shared/db/connection');
const { connectRedis, closeRedis, connectEqpRedis, closeEqpRedis } = require('./shared/db/redisConnection');
const { registerEqpRedisHooks } = require('./features/clients/eqpInfoRedisSync');
const { initializeDefaultPermissions } = require('./features/permissions/service');
const { initializeRolePermissions } = require('./features/users/service');
const { initializeOSVersions } = require('./features/os-version/service');
const { initialize: initializeImageStorage } = require('./features/images/service');
const { initializeExecCommands } = require('./features/exec-commands/service');
const { initializeConfigSettings } = require('./features/clients/configSettingsService')
const { initializeLogSettings } = require('./features/clients/logSettingsService')
const { initializeUpdateSettings } = require('./features/clients/updateSettingsService')
const { initializeRecoverySummary, startCronJobs, stopCronJobs } = require('./features/recovery/recoverySummaryService')
const { initializeRecoveryCategoryMap } = require('./features/recovery/recoveryCategoryService')
const { releaseLock } = require('./shared/utils/redisLock')
const { getRedisClient } = require('./shared/db/redisConnection')
const { getPodId } = require('./shared/utils/podIdentity')

const serverLog = createLogger('server');
const PORT = process.env.PORT || 3000;

// Connect to MongoDB and start server
const startServer = async () => {
  try {
    await connectDB();
    await connectRedis();
    await connectEqpRedis();

    // Sync permissions and initialize data
    serverLog.info('Syncing permissions...');
    await initializeDefaultPermissions();
    await initializeRolePermissions();
    await initializeOSVersions();
    await initializeImageStorage();
    await initializeExecCommands();
    await initializeConfigSettings();
    await initializeLogSettings();
    await initializeUpdateSettings();
    await initializeRecoverySummary();
    await initializeRecoveryCategoryMap();
    serverLog.info('Permissions synced');

    registerEqpRedisHooks();

    const server = app.listen(PORT, () => {
      serverLog.info(`Server running on http://localhost:${PORT}`);
    });

    // Start cron jobs after server is listening
    startCronJobs();

    // Graceful shutdown
    let isShuttingDown = false

    const gracefulShutdown = async (signal) => {
      if (isShuttingDown) return
      isShuttingDown = true
      serverLog.info(`${signal} received. Shutting down gracefully...`)

      // 강제 종료 타임아웃
      const forceTimer = setTimeout(() => {
        serverLog.error('Forced shutdown: timeout exceeded')
        process.exit(1)
      }, 10000)
      forceTimer.unref()

      try {
        // 1. 새 연결 수락 중단
        server.close()
        serverLog.info('Stopped accepting new connections')

        // 2. 진행 중인 요청 완료 대기
        await new Promise(resolve => setTimeout(resolve, 5000))

        // 3. 남은 연결 강제 종료 (SSE 등 — res.on('close') 핸들러 자동 호출)
        server.closeAllConnections()
        serverLog.info('Closed all remaining connections')

        // 4. Cron 중지
        stopCronJobs()

        // M1: 분산 락 즉시 해제 — 다른 Pod의 다음 cron/backfill 지연 방지 (TTL 600s 대기 회피)
        // releaseLock은 Lua compare-and-delete: 자기 소유 락만 삭제하므로 안전
        try {
          const redis = getRedisClient()
          if (redis) {
            const pod = getPodId()
            await Promise.all([
              releaseLock(redis, 'wm:cron:lock:hourly', pod),
              releaseLock(redis, 'wm:cron:lock:daily', pod),
              releaseLock(redis, 'wm:backfill:owner', pod)
            ])
            serverLog.info('Distributed locks released')
          }
        } catch (err) {
          serverLog.warn(`Distributed lock cleanup error: ${err?.message || err}`)
        }

        // 5. DB 연결 종료
        await closeConnections()
        await closeRedis()
        await closeEqpRedis()

        process.exit(0)
      } catch (err) {
        serverLog.error(`Error during shutdown: ${err.message}`)
        process.exit(1)
      }
    }

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
    process.on('SIGINT', () => gracefulShutdown('SIGINT'))
  } catch (error) {
    serverLog.error(`Failed to start server: ${error.message}`);
    process.exit(1);
  }
};

startServer();
