const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/auth');

/**
 * Authentication Routes
 * Handles user registration, login, and current user retrieval
 * Requirements: 1.1, 1.2, 2.1
 */

// POST /api/auth/register - Register new user
router.post('/register', authController.register);

// POST /api/auth/login - Login user
router.post('/login', authController.login);

// GET /api/auth/me - Get current user (protected)
router.get('/me', authMiddleware, authController.getCurrentUser);

module.exports = router;
