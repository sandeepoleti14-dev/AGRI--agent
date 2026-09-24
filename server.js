require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cors = require('cors');

// Import modular routes
const authRoutes = require('./routes/authRoutes');
const noteRoutes = require('./routes/noteRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for frontend requests
app.use(cors({
  origin: true,
  credentials: true
}));

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session management
app.use(session({
  name: 'student_notes_sid',
  secret: process.env.SESSION_SECRET || 'secure_default_session_secret_key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
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
        'POST /api/login-vulnerable (SQL Injection demo)',
        'POST /api/logout',
        'GET  /api/me'
      ],
      notes: [
        'GET    /api/notes',
        'POST   /api/notes (256-byte limit enforced)',
        'GET    /api/notes/:id',
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
  res.status(500).json({ error: 'Internal server error occurred.' });
});

// Start listening
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(` Server is running on port ${PORT}`);
    console.log(` API Base URL: http://localhost:${PORT}/api`);
    console.log(`====================================================`);
  });
}

module.exports = app;
