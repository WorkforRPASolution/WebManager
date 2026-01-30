const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const { errorHandler, notFoundHandler } = require('./shared/middleware/errorHandler');

const app = express();

// Security headers
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for API server
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'];
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

// Body parser
app.use(express.json({ limit: '10mb' }));

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Feature routes
app.use('/api/auth', require('./features/auth/routes'));
app.use('/api/dashboard', require('./features/dashboard/routes'));
app.use('/api/clients', require('./features/clients/routes'));
app.use('/api/users', require('./features/users/routes'));
app.use('/api/email-template', require('./features/email-template/routes'));
app.use('/api/email-info', require('./features/email-info/routes'));
app.use('/api/permissions', require('./features/permissions/routes'));
app.use('/api/os-version', require('./features/os-version/routes'));
app.use('/api/email-recipients', require('./features/email-recipients/routes'));

// Production: Serve static files from client/dist
if (process.env.NODE_ENV === 'production') {
  const clientDistPath = path.join(__dirname, '../client/dist');
  app.use(express.static(clientDistPath));

  // SPA fallback: serve index.html for all non-API routes
  app.get('*', (req, res, next) => {
    // Skip API routes
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
