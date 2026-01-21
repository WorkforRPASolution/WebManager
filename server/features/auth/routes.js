/**
 * Authentication routes
 */

const express = require('express')
const router = express.Router()
const controller = require('./controller')
const { asyncHandler } = require('../../shared/middleware/errorHandler')
const { authenticate } = require('../../shared/middleware/authMiddleware')

// POST /api/auth/login - Login with credentials
router.post('/login', asyncHandler(controller.login))

// POST /api/auth/refresh - Refresh access token
router.post('/refresh', asyncHandler(controller.refresh))

// POST /api/auth/logout - Logout
router.post('/logout', authenticate, asyncHandler(controller.logout))

// GET /api/auth/me - Get current user info
router.get('/me', authenticate, asyncHandler(controller.me))

module.exports = router
