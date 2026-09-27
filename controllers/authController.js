let bcrypt;
try {
  bcrypt = require('bcrypt');
} catch (e) {
  bcrypt = require('bcryptjs');
}

const db = require('../config/db');

const SALT_ROUNDS = 10;

/**
 * Register a new student
 * Uses email + password.
 */
async function register(req, res) {
  try {
    const { name, email, password } = req.body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({
        error: 'Name is required.'
      });
    }

    if (!email || typeof email !== 'string' || email.trim() === '') {
      return res.status(400).json({
        error: 'Email is required.'
      });
    }

    if (!password || typeof password !== 'string' || password.length < 4) {
      return res.status(400).json({
        error: 'Password must be at least 4 characters long.'
      });
    }

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    // Check whether email already exists
    const existing = await db.query(
      'SELECT id FROM users WHERE email = $1',
      [cleanEmail]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({
        error: 'Email already registered. Please use another email.'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // Insert user
    const result = await db.query(
      `INSERT INTO users (name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, name, email, created_at`,
      [cleanName, cleanEmail, hashedPassword]
    );

    const user = result.rows[0];

    // Establish session
    req.session.userId = user.id;
    req.session.email = user.email;
    req.session.name = user.name;

    return res.status(201).json({
      message: 'User registered successfully.',
      user
    });

  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({
      error: 'Internal server error during registration.'
    });
  }
}

/**
 * Secure login
 */
async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required.'
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Parameterized PostgreSQL query
    const result = await db.query(
      `SELECT id, name, email, password_hash
       FROM users
       WHERE email = $1`,
      [cleanEmail]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: 'Invalid email or password.'
      });
    }

    const user = result.rows[0];

    // Compare password with stored bcrypt hash
    const isMatch = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!isMatch) {
      return res.status(401).json({
        error: 'Invalid email or password.'
      });
    }

    // Establish session
    req.session.userId = user.id;
    req.session.email = user.email;
    req.session.name = user.name;

    return res.json({
      message: 'Login successful.',
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      error: 'Internal server error during login.'
    });
  }
}

/**
 * SQL Injection demonstration
 *
 * This endpoint intentionally demonstrates what NOT to do.
 */
async function loginVulnerable(req, res) {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        error: 'Email is required.'
      });
    }

    // INTENTIONALLY INSECURE - demonstration only
    const rawSql =
      `SELECT id, name, email, password_hash FROM users WHERE email = '${email}'`;

    console.warn(
      `[SQL INJECTION DEMO] Executing raw query: ${rawSql}`
    );

    const result = await db.query(rawSql);

    if (result.rows.length > 0) {
      const injectedUser = result.rows[0];

      req.session.userId = injectedUser.id;
      req.session.email = injectedUser.email;
      req.session.name = injectedUser.name;

      return res.json({
        warning:
          'DEMO VULNERABILITY: Raw SQL was executed without parameterization.',
        executedSql: rawSql,
        message: 'Authentication bypass demonstration.',
        user: {
          id: injectedUser.id,
          name: injectedUser.name,
          email: injectedUser.email
        }
      });
    }

    return res.status(401).json({
      error: 'No matching user found.',
      executedSql: rawSql
    });

  } catch (error) {
    return res.status(400).json({
      error: 'SQL Execution Error: ' + error.message
    });
  }
}

/**
 * Logout
 */
function logout(req, res) {
  if (!req.session || !req.session.userId) {
    return res.status(200).json({
      message: 'Already logged out or no active session.'
    });
  }

  req.session.destroy((err) => {
    if (err) {
      console.error('Session destruction error:', err);

      return res.status(500).json({
        error: 'Could not log out. Please try again.'
      });
    }

    res.clearCookie('student_notes_sid');

    return res.json({
      message: 'Logout successful.'
    });
  });
}

/**
 * Get current authenticated user
 */
function getCurrentUser(req, res) {
  if (req.session && req.session.userId) {
    return res.json({
      authenticated: true,
      user: {
        id: req.session.userId,
        name: req.session.name,
        email: req.session.email
      }
    });
  }

  return res.status(401).json({
    authenticated: false,
    error: 'Not authenticated.'
  });
}

module.exports = {
  register,
  login,
  loginVulnerable,
  logout,
  getCurrentUser
};