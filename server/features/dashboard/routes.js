const express = require('express');
const router = express.Router();
const Client = require('../clients/model');
const { asyncHandler } = require('../../shared/middleware/errorHandler');
const { authenticate, requireMenuPermission } = require('../../shared/middleware/authMiddleware');
const { getRedisClient, isRedisAvailable } = require('../../shared/db/redisConnection');
const { buildAgentRunningKey, parseAliveValue } = require('../clients/agentAliveService');

// GET /api/dashboard/summary - Get dashboard KPI summary (requires 'dashboard' permission)
router.get('/summary', authenticate, requireMenuPermission('dashboard'), asyncHandler(async (req, res) => {
  const totalClients = await Client.countDocuments();
  const activeClients = await Client.countDocuments({ onoff: 1 });
  const inactiveClients = totalClients - activeClients;

  // Get clients by process for breakdown
  const processCounts = await Client.aggregate([
    { $group: { _id: '$process', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);

  // Mock data for uptime and network (will be from Akka server in Phase 3)
  const summary = {
    activeClients,
    totalClients,
    inactiveClients,
    activeRate: totalClients > 0 ? ((activeClients / totalClients) * 100).toFixed(1) : 0,
    uptime: '99.9%',
    errors: Math.floor(Math.random() * 5),
    networkTraffic: `${(Math.random() * 100).toFixed(1)} MB/s`,
    processCounts: processCounts.map(p => ({
      process: p._id,
      count: p.count
    }))
  };

  res.json(summary);
}));

// GET /api/dashboard/agent-status - 프로세스별 ARSAgent 수량 및 Running 상태 조회
router.get('/agent-status', authenticate, requireMenuPermission('dashboard'), asyncHandler(async (req, res) => {
  // 1. MongoDB: 최소 필드만 조회 (indexed on process, lean)
  const clients = await Client.find({})
    .select('process eqpModel eqpId')
    .lean()

  // 2. 프로세스별 AgentCount 집계 + Redis 키 생성
  const processMap = {} // { process: { agentCount, runningCount } }
  const keys = []
  const keyProcessMap = [] // keys[i]가 어떤 process에 속하는지

  for (const c of clients) {
    if (!processMap[c.process]) {
      processMap[c.process] = { agentCount: 0, runningCount: 0 }
    }
    processMap[c.process].agentCount++
    keys.push(buildAgentRunningKey(c.process, c.eqpModel, c.eqpId))
    keyProcessMap.push(c.process)
  }

  // 3. Redis 배치 mget (500개씩 분할)
  if (isRedisAvailable() && keys.length > 0) {
    const redis = getRedisClient()
    const BATCH_SIZE = 500
    const allValues = []

    for (let i = 0; i < keys.length; i += BATCH_SIZE) {
      const batch = keys.slice(i, i + BATCH_SIZE)
      const vals = await redis.mget(batch)
      allValues.push(...vals)
    }

    // 4. Running 카운트 집계
    for (let i = 0; i < allValues.length; i++) {
      const parsed = parseAliveValue(allValues[i])
      if (parsed.alive) {
        processMap[keyProcessMap[i]].runningCount++
      }
    }
  }

  // 5. 결과 정렬 (process 이름순)
  const result = Object.entries(processMap)
    .map(([process, counts]) => ({
      process,
      agentCount: counts.agentCount,
      runningCount: counts.runningCount,
    }))
    .sort((a, b) => a.process.localeCompare(b.process))

  res.json({ data: result, redisAvailable: isRedisAvailable() })
}));

module.exports = router;
