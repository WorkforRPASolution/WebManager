const express = require('express')
const router = express.Router()
const { asyncHandler } = require('../../shared/middleware/errorHandler')
const { authenticate, requireMenuPermission } = require('../../shared/middleware/authMiddleware')
const controller = require('./controller')

// GET /api/recovery/overview - Recovery 전체 현황 KPI + 트렌드 + Top N
router.get('/overview', authenticate, requireMenuPermission('dashboardRecoveryOverview'), asyncHandler(controller.getOverview))

// GET /api/recovery/by-process - 공정별 Recovery 비교
router.get('/by-process', authenticate, requireMenuPermission('dashboardRecoveryByProcess'), asyncHandler(controller.getByProcess))

// GET /api/recovery/analysis - 드릴다운 분석 (시나리오/장비/트리거 탭)
router.get('/analysis', authenticate, requireMenuPermission('dashboardRecoveryAnalysis'), asyncHandler(controller.getAnalysis))

// GET /api/recovery/history - 원본 이력 조회 (최대 7일, eqpid 또는 ears_code 필수)
router.get('/history', authenticate, requireMenuPermission('dashboardRecoveryAnalysis'), asyncHandler(controller.getHistory))

// GET /api/recovery/last-aggregation - 마지막 집계 시각 조회
router.get('/last-aggregation', authenticate, asyncHandler(controller.getLastAggregation))

module.exports = router
