const express = require('express');
const authController = require('../controllers/authController');

const router = express.Router();

// User Registration
router.post('/register', authController.register);

// Secure Login (Parameterized queries + Bcrypt)
router.post('/login', authController.login);

// Insecure Login Demonstration (SQL Injection demonstration)
router.post('/login-vulnerable', authController.loginVulnerable);

// Logout and session invalidation
router.post('/logout', authController.logout);

// Current user profile from session
router.get('/me', authController.getCurrentUser);

module.exports = router;
