const express = require('express')
const router = express.Router()
const { asyncHandler } = require('../../shared/middleware/errorHandler')
const { authenticate, requireRole } = require('../../shared/middleware/authMiddleware')
const controller = require('./controller')

// All system-logs endpoints: Admin only (role level 1)

// GET /api/system-logs - 로그 목록 (필터/페이지네이션)
router.get('/', authenticate, requireRole([1]), asyncHandler(controller.getLogs))

// GET /api/system-logs/statistics - 통계 집계
router.get('/statistics', authenticate, requireRole([1]), asyncHandler(controller.getStats))

// GET /api/system-logs/:id - 단건 상세
router.get('/:id', authenticate, requireRole([1]), asyncHandler(controller.getLogDetail))

module.exports = router
