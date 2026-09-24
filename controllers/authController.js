let bcrypt;
try {
  bcrypt = require('bcrypt');
} catch (e) {
  bcrypt = require('bcryptjs');
}

const db = require('../config/db');

const SALT_ROUNDS = 10;

/**
 * Register a new student account
 * Uses bcrypt password hashing and parameterized SQL queries.
 */
async function register(req, res) {
  try {
    const { username, password } = req.body;

    if (!username || typeof username !== 'string' || username.trim() === '') {
      return res.status(400).json({ error: 'Username is required and cannot be empty.' });
    }

    if (!password || typeof password !== 'string' || password.length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters long.' });
    }

    const cleanUsername = username.trim();

    // Check if username already exists using a parameterized query
    const [existing] = await db.query('SELECT id FROM users WHERE username = ?', [cleanUsername]);
    if (existing && existing.length > 0) {
      return res.status(409).json({ error: 'Username already taken. Please choose another.' });
    }

    // Hash password with bcrypt
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // Insert user using parameterized query to prevent SQL injection
    const [result] = await db.query('INSERT INTO users (username, password) VALUES (?, ?)', [
      cleanUsername,
      hashedPassword
    ]);

    // Establish authenticated session
    req.session.userId = result.insertId;
    req.session.username = cleanUsername;

    return res.status(201).json({
      message: 'User registered successfully.',
      user: {
        id: result.insertId,
        username: cleanUsername
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ error: 'Internal server error during registration.' });
  }
}

/**
 * Secure login
 * Prevents SQL injection using parameterized query (?) and verifies hash with bcrypt.
 */
async function login(req, res) {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Both username and password are required.' });
    }

    // SECURE: Parameterized query ensures user input is strictly treated as data
    const [rows] = await db.query('SELECT id, username, password FROM users WHERE username = ?', [
      username.trim()
    ]);

    if (!rows || rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const user = rows[0];

    // Verify password against stored bcrypt hash
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    // Set authenticated session
    req.session.userId = user.id;
    req.session.username = user.username;

    return res.json({
      message: 'Login successful.',
      user: {
        id: user.id,
        username: user.username
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal server error during login.' });
  }
}

/**
 * Insecure Login Demonstration
 * Shows vulnerability to SQL injection when user input is concatenated directly.
 * Example payload: { "username": "' OR '1'='1' -- ", "password": "any" }
 */
async function loginVulnerable(req, res) {
  try {
    const { username } = req.body;

    if (!username) {
      return res.status(400).json({ error: 'Username is required.' });
    }

    // INSECURE: Direct concatenation enables SQL injection
    const rawSql = `SELECT id, username, password FROM users WHERE username = '${username}'`;
    console.warn(`[SQL INJECTION DEMO] Executing raw query: ${rawSql}`);

    const [rows] = await db.query(rawSql);

    if (rows && rows.length > 0) {
      const injectedUser = rows[0];
      req.session.userId = injectedUser.id;
      req.session.username = injectedUser.username;

      return res.json({
        warning: 'DEMO VULNERABILITY EXPLOITED: Raw SQL was executed without parameterization!',
        executedSql: rawSql,
        message: 'Bypassed authentication via SQL injection!',
        user: {
          id: injectedUser.id,
          username: injectedUser.username
        }
      });
    }

    return res.status(401).json({
      error: 'Invalid credentials or query returned no rows.',
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
 * Destroys session on the server and clears the session cookie.
 */
function logout(req, res) {
  if (!req.session || !req.session.userId) {
    return res.status(200).json({ message: 'Already logged out or no active session.' });
  }

  req.session.destroy((err) => {
    if (err) {
      console.error('Session destruction error:', err);
      return res.status(500).json({ error: 'Could not log out. Please try again.' });
    }
    res.clearCookie('student_notes_sid');
    return res.json({ message: 'Logout successful.' });
  });
}

/**
 * Get current authenticated user session
 */
function getCurrentUser(req, res) {
  if (req.session && req.session.userId) {
    return res.json({
      authenticated: true,
      user: {
        id: req.session.userId,
        username: req.session.username
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
