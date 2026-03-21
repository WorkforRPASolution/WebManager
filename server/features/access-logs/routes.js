const express = require('express')
const router = express.Router()
const { asyncHandler } = require('../../shared/middleware/errorHandler')
const { optionalAuth } = require('../../shared/middleware/authMiddleware')
const controller = require('./controller')

// POST /api/access-logs - 배치 수집 (프론트엔드 → 서버)
// optionalAuth: sendBeacon은 Authorization 헤더를 보낼 수 없으므로
// body.token 폴백 지원 (controller에서 처리)
router.post('/', optionalAuth, asyncHandler(controller.collectAccessLogs))

module.exports = router
