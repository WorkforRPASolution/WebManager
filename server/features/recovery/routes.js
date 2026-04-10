const express = require('express')
const router = express.Router()
const { asyncHandler } = require('../../shared/middleware/errorHandler')
const { authenticate, requireMenuPermission, requireRole } = require('../../shared/middleware/authMiddleware')
const controller = require('./controller')

// GET /api/recovery/overview - Recovery 전체 현황 KPI + 트렌드 + Top N
router.get('/overview', authenticate, requireMenuPermission('dashboardRecoveryOverview'), asyncHandler(controller.getOverview))

// GET /api/recovery/by-process - 공정별 Recovery 비교
router.get('/by-process', authenticate, requireMenuPermission('dashboardRecoveryByProcess'), asyncHandler(controller.getByProcess))

// GET /api/recovery/analysis/filters - 데이터가 있는 공정/모델 목록
router.get('/analysis/filters', authenticate, requireMenuPermission('dashboardRecoveryAnalysis'), asyncHandler(controller.getAnalysisFilters))

// GET /api/recovery/analysis - 드릴다운 분석 (시나리오/장비/트리거 탭)
router.get('/analysis', authenticate, requireMenuPermission('dashboardRecoveryAnalysis'), asyncHandler(controller.getAnalysis))

// GET /api/recovery/history - 원본 이력 조회 (최대 7일, eqpid 또는 ears_code 필수)
router.get('/history', authenticate, requireMenuPermission('dashboardRecoveryAnalysis'), asyncHandler(controller.getHistory))

// GET /api/recovery/last-aggregation - 마지막 집계 시각 조회
router.get('/last-aggregation', authenticate, asyncHandler(controller.getLastAggregation))

// Backfill API (Admin only - role level 1)
router.post('/backfill/analyze', authenticate, requireRole([1]), asyncHandler(controller.analyzeBackfill))
router.post('/backfill', authenticate, requireRole([1]), asyncHandler(controller.startBackfill))
router.get('/backfill/status', authenticate, requireRole([1]), asyncHandler(controller.getBackfillStatus))
router.get('/backfill/distribution', authenticate, requireRole([1]), asyncHandler(controller.getCronRunDistribution))
router.post('/backfill/cancel', authenticate, requireRole([1]), asyncHandler(controller.cancelBackfill))

// GET /api/recovery/by-category - 카테고리별 Recovery 비교
router.get('/by-category', authenticate, requireMenuPermission('dashboardRecoveryByCategory'), asyncHandler(controller.getByCategory))

// Category Map CRUD
router.get('/category-map/sc-categories', authenticate, requireMenuPermission('dashboardRecoveryByCategory'), asyncHandler(controller.getScCategories))
router.get('/category-map', authenticate, requireMenuPermission('dashboardRecoveryByCategory'), asyncHandler(controller.getCategoryMap))
router.put('/category-map', authenticate, requireRole([1]), asyncHandler(controller.upsertCategoryMap))
router.delete('/category-map', authenticate, requireRole([1]), asyncHandler(controller.deleteCategoryMap))

// Batch Logs API (Admin only)
router.get('/batch-logs', authenticate, requireRole([1]), asyncHandler(controller.getBatchLogs))
router.get('/batch-logs/heatmap', authenticate, requireRole([1]), asyncHandler(controller.getBatchHeatmap))

module.exports = router
