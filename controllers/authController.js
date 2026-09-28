let bcrypt;
try {
  bcrypt = require('bcrypt');
} catch (e) {
  bcrypt = require('bcryptjs');
}

const db = require('../config/db');

const SALT_ROUNDS = 10;

function establishSession(req, user) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error) => {
      if (error) {
        return reject(error);
      }

      req.session.userId = user.id;
      req.session.email = user.email;
      req.session.name = user.name;
      req.session.phone = user.phone;

      req.session.save((saveError) => {
        if (saveError) {
          return reject(saveError);
        }

        resolve();
      });
    });
  });
}

/**
 * Register a new user - DIRECT registration without OTP verification
 * Saves: name, email, phone, password
 */
async function register(req, res) {
  try {
    const { name, email, phone, password } = req.body;

    // Validation
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

    if (!phone || typeof phone !== 'string' || phone.trim() === '') {
      return res.status(400).json({
        error: 'Phone is required.'
      });
    }

    if (!password || typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({
        error: 'Password must be at least 8 characters long.'
      });
    }

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone.trim();

    // Check if email already exists
    const emailExists = await db.query(
      'SELECT id FROM users WHERE email = $1',
      [cleanEmail]
    );

    if (emailExists.rows.length > 0) {
      return res.status(409).json({
        error: 'Email already registered. Please use another email.'
      });
    }

    // Check if phone already exists
    const phoneExists = await db.query(
      'SELECT id FROM users WHERE phone = $1',
      [cleanPhone]
    );

    if (phoneExists.rows.length > 0) {
      return res.status(409).json({
        error: 'Phone number already registered. Please use another phone.'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // Insert user into database - NO verification codes needed
    const result = await db.query(
      `INSERT INTO users (name, email, phone, password_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, phone, created_at`,
      [cleanName, cleanEmail, cleanPhone, hashedPassword]
    );

    const user = result.rows[0];

    // Establish session immediately after registration
    await establishSession(req, user);

    return res.status(201).json({
      message: 'User registered successfully. You are now logged in.',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone
      }
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

    if (
      typeof email !== 'string' ||
      email.trim() === '' ||
      typeof password !== 'string' ||
      password === ''
    ) {
      return res.status(400).json({
        error: 'Email and password are required.'
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Parameterized PostgreSQL query
    const result = await db.query(
      `SELECT id, name, email, phone, password_hash
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
    await establishSession(req, user);

    return res.json({
      message: 'Login successful.',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone
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
      `SELECT id, name, email, phone, password_hash FROM users WHERE email = '${email}'`;

    console.warn(
      `[SQL INJECTION DEMO] Executing raw query: ${rawSql}`
    );

    const result = await db.query(rawSql);

    if (result.rows.length > 0) {
      const injectedUser = result.rows[0];

      req.session.userId = injectedUser.id;
      req.session.email = injectedUser.email;
      req.session.name = injectedUser.name;
      req.session.phone = injectedUser.phone;

      return res.json({
        warning:
          'DEMO VULNERABILITY: Raw SQL was executed without parameterization.',
        executedSql: rawSql,
        message: 'Authentication bypass demonstration.',
        user: {
          id: injectedUser.id,
          name: injectedUser.name,
          email: injectedUser.email,
          phone: injectedUser.phone
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

    res.clearCookie('student_notes_sid', { path: '/' });

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
        email: req.session.email,
        phone: req.session.phone
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
  logout,
  getCurrentUser
};