const express = require('express')
const router = express.Router()
const { asyncHandler } = require('../../shared/middleware/errorHandler')
const { authenticate, requireMenuPermission } = require('../../shared/middleware/authMiddleware')
const controller = require('./controller')

// GET /api/user-activity/tool-usage - ScenarioEditor 사용 통계
router.get('/tool-usage', authenticate, requireMenuPermission('dashboardUserActivity'), asyncHandler(controller.getToolUsage))

// GET /api/user-activity/scenario-stats - 시나리오 작성 통계
router.get('/scenario-stats', authenticate, requireMenuPermission('dashboardUserActivity'), asyncHandler(controller.getScenarioStats))

// GET /api/user-activity/scenario-details - 시나리오 상세 목록 (CSV 내보내기용)
router.get('/scenario-details', authenticate, requireMenuPermission('dashboardUserActivity'), asyncHandler(controller.getScenarioDetails))

// GET /api/user-activity/webmanager-stats - WebManager 사용 통계
router.get('/webmanager-stats', authenticate, requireMenuPermission('dashboardUserActivity'), asyncHandler(controller.getWebManagerStats))

module.exports = router
