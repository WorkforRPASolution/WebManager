const express = require('express');
const router = express.Router();

// POST /api/auth/login - Mock login
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  // Mock authentication (will implement proper auth in future)
  if (username === 'admin' && password === 'admin') {
    res.json({
      success: true,
      token: 'mock-jwt-token-' + Date.now(),
      user: {
        id: 1,
        username: 'admin',
        name: 'Admin User',
        email: 'admin@webmanager.com',
        role: 'admin'
      }
    });
  } else {
    res.status(401).json({
      success: false,
      error: 'Invalid credentials'
    });
  }
});

// POST /api/auth/logout - Mock logout
router.post('/logout', (req, res) => {
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

// GET /api/auth/me - Get current user
router.get('/me', (req, res) => {
  // Mock user data (will implement proper auth in future)
  res.json({
    id: 1,
    username: 'admin',
    name: 'Admin User',
    email: 'admin@webmanager.com',
    role: 'admin'
  });
});

module.exports = router;
