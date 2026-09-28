require('dotenv').config();
const { randomBytes } = require('node:crypto');
const express = require('express');
const session = require('express-session');
const cors = require('cors');

// Import modular routes
const authRoutes = require('./routes/authRoutes');
const noteRoutes = require('./routes/noteRoutes');

const app = express();
const PORT = process.env.PORT || 3000;
const sessionSecret = process.env.SESSION_SECRET || (
  process.env.NODE_ENV === 'production'
    ? null
    : randomBytes(32).toString('hex')
);

if (!sessionSecret) {
  throw new Error('SESSION_SECRET must be set in production.');
}

const allowedOrigins = new Set(
  (process.env.FRONTEND_ORIGINS || 'http://127.0.0.1:5500,http://localhost:5500')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
);

app.use((req, res, next) => {
  const origin = req.get('Origin');
  if (origin && !allowedOrigins.has(origin)) {
    return res.status(403).json({ error: 'Origin not allowed.' });
  }
  next();
});

app.use(cors({
  origin(origin, callback) {
    callback(null, !origin || allowedOrigins.has(origin));
  },
  credentials: true
}));

// Body parsers
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true }));

// Session management
app.use(session({
  name: 'student_notes_sid',
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 1000 * 60 * 60 * 24 // 24 hours
  }
}));

// API root summary
app.get('/api', (req, res) => {
  res.json({
    status: 'online',
    service: 'Secure Student Notes Backend API',
    endpoints: {
      auth: [
        'POST /api/register',
        'POST /api/login',
        'POST /api/logout',
        'GET  /api/me'
      ],
      notes: [
        'GET    /api/notes',
        'POST   /api/notes',
        'GET    /api/notes/:id',
        'PUT    /api/notes/:id',
        'GET    /api/notes/:id/attachment',
        'DELETE /api/notes/:id'
      ]
    }
  });
});

// Mount routes
app.use('/api', authRoutes);
app.use('/api/notes', noteRoutes);

// 404 Route handler
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.originalUrl} not found.` });
});

// Centralized error handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  const status = err.statusCode || err.status || 500;
  res.status(status).json({
    error: status >= 500 ? 'Internal server error occurred.' : err.message
  });
});

// Start listening
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(` Server is running on port ${PORT}`);
    console.log(` API Base URL: http://127.0.0.1:${PORT}/api`);
    console.log(`====================================================`);
  });
}

module.exports = app;
