const express = require('express');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Feature routes
app.use('/api/auth', require('./features/auth/routes'));
app.use('/api/dashboard', require('./features/dashboard/routes'));
app.use('/api/clients', require('./features/clients/routes'));
app.use('/api/users', require('./features/users/routes'));

module.exports = app;
