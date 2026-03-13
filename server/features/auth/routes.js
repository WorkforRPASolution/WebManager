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

// POST /api/auth/signup - Register a new user
router.post('/signup', asyncHandler(controller.signup))

// POST /api/auth/refresh - Refresh access token
router.post('/refresh', asyncHandler(controller.refresh))

// POST /api/auth/logout - Logout
router.post('/logout', authenticate, asyncHandler(controller.logout))

// GET /api/auth/me - Get current user info
router.get('/me', authenticate, asyncHandler(controller.me))

// POST /api/auth/request-password-reset - Request password reset
router.post('/request-password-reset', asyncHandler(controller.requestPasswordReset))

// POST /api/auth/change-password - Change password (logged-in users)
router.post('/change-password', authenticate, asyncHandler(controller.changePassword))

// POST /api/auth/set-new-password - Set new password after reset approval
router.post('/set-new-password', authenticate, asyncHandler(controller.setNewPassword))

// GET /api/auth/check-id - Check if user ID is available (public)
router.get('/check-id', asyncHandler(controller.checkId))

// GET /api/auth/search-clients - Search EQP_INFO by keyword for Process help (public)
router.get('/search-clients', asyncHandler(controller.searchClients))

// GET /api/auth/signup-options - Get processes and lines for signup form (public)
router.get('/signup-options', asyncHandler(controller.getSignupOptions))

// GET /api/auth/operation-mode - Get current operation mode (public)
router.get('/operation-mode', asyncHandler(controller.getOperationMode))

module.exports = router
