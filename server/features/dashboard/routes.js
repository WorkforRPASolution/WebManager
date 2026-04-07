const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../../shared/middleware/errorHandler');
const { authenticate, requireMenuPermission } = require('../../shared/middleware/authMiddleware');
const controller = require('./controller');

// GET /api/dashboard/summary - Get dashboard KPI summary (requires 'dashboardOverview' permission)
router.get('/summary', authenticate, requireMenuPermission('dashboardOverview'), asyncHandler(controller.getSummary));

// GET /api/dashboard/agent-status - 프로세스별 ARSAgent 수량 및 Running 상태 조회
router.get('/agent-status', authenticate, requireMenuPermission('dashboardArsMonitor'), asyncHandler(controller.getAgentStatus));

// GET /api/dashboard/agent-version - 프로세스별 ARSAgent 버전 분포 조회
router.get('/agent-version', authenticate, requireMenuPermission('dashboardArsVersion'), asyncHandler(controller.getAgentVersionDistribution));

// GET /api/dashboard/resource-agent-status - ResourceAgent 가동 현황 (5상태)
router.get('/resource-agent-status', authenticate, requireMenuPermission('dashboardResStatus'), asyncHandler(controller.getResourceAgentStatus));

// GET /api/dashboard/resource-agent-version - ResourceAgent 버전 분포
router.get('/resource-agent-version', authenticate, requireMenuPermission('dashboardResVersion'), asyncHandler(controller.getResourceAgentVersionDistribution));

module.exports = router;
