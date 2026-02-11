require('dotenv').config();
const app = require('./app');
const { connectDB, closeConnections } = require('./shared/db/connection');
const { initializeDefaultPermissions } = require('./features/permissions/service');
const { initializeRolePermissions } = require('./features/users/service');
const { initializeOSVersions } = require('./features/os-version/service');
const { initialize: initializeImageStorage } = require('./features/images/service');
const { initializeExecCommands } = require('./features/exec-commands/service');
const { initializeConfigSettings } = require('./features/clients/configSettingsService')
const { initializeLogSettings } = require('./features/clients/logSettingsService')

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
    await initializeImageStorage();
    await initializeExecCommands();
    await initializeConfigSettings();
    await initializeLogSettings();
    console.log('Permissions synced');

    const server = app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });

    // Graceful shutdown
    let isShuttingDown = false

    const gracefulShutdown = async (signal) => {
      if (isShuttingDown) return
      isShuttingDown = true
      console.log(`\n${signal} received. Shutting down gracefully...`)

      // 강제 종료 타임아웃
      const forceTimer = setTimeout(() => {
        console.error('Forced shutdown: timeout exceeded')
        process.exit(1)
      }, 10000)
      forceTimer.unref()

      try {
        // 1. 새 연결 수락 중단
        server.close()
        console.log('Stopped accepting new connections')

        // 2. 진행 중인 요청 완료 대기
        await new Promise(resolve => setTimeout(resolve, 5000))

        // 3. 남은 연결 강제 종료 (SSE 등 — res.on('close') 핸들러 자동 호출)
        server.closeAllConnections()
        console.log('Closed all remaining connections')

        // 4. DB 연결 종료
        await closeConnections()

        process.exit(0)
      } catch (err) {
        console.error('Error during shutdown:', err)
        process.exit(1)
      }
    }

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
    process.on('SIGINT', () => gracefulShutdown('SIGINT'))
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
